// https://docs.agora.io/en/Interactive%20Broadcast/token_server

package main

import (
	"os"
	"flag"
	"fmt"
	"log"
	"sync"
	"strings"
	"strconv"
	"net/http"
	"time"
	"io/ioutil"
	"encoding/json"
	"github.com/gorilla/websocket"
	rtctokenbuilder "github.com/AgoraIO/Tools/DynamicKey/AgoraDynamicKey/go/src/RtcTokenBuilder"
)


type P2PClient struct {
	uid string
	websocketConnection *websocket.Conn
	mutex *sync.Mutex
}

var p2pClients = make(map[string]*P2PClient)
var p2pChannels = make(map[string]map[string]*P2PClient) // map from channel name to (map of uid to p2pClients)


func checkError(err error) {
	if err != nil {
		panic(err)
	}
}


// Use RtcTokenBuilder to generate an RTC token.
func generateRtcToken(int_uid uint32, channelName string, role rtctokenbuilder.Role, expireTimeInSeconds uint32) string {

	appID := "aee8658414ec41a4a5d97a79ddf86bd7"
	appCertificate := "f01f7d954f614a508ae81a672e8cd557"
	currentTimestamp := uint32(time.Now().UTC().Unix()) // Get current timestamp.
	expireTimestamp := currentTimestamp + expireTimeInSeconds // Timestamp when the token expires.

	result, err := rtctokenbuilder.BuildTokenWithUID(appID, appCertificate, channelName, int_uid, role, expireTimestamp)

	if err != nil {
		fmt.Println(err)
	} else {
		fmt.Printf("new token: uid=%v channel-name=%v role=%v token=%v\n", int_uid, channelName, role, result)
	}
	return result
}


func keepAlive(c *websocket.Conn, timeout time.Duration) {
    lastResponse := time.Now()
    c.SetPongHandler(func(msg string) error {
		lastResponse = time.Now()
		return nil
	})

	go func() {
		for {
			err := c.WriteMessage(websocket.PingMessage, []byte("keepalive"))
			if err != nil {
				return
			}
			time.Sleep(timeout/2)
			if(time.Since(lastResponse) > timeout) {
				c.Close()
				return
			}
		}
	}()
}


func getAgoraChannelPrefixFromDemoGroup(demoGroupName string) string {

    // mappingStr := `{ "accel": "hifi-1", "jerk": "hifi-2", "snap": "hifi-3", "crackle": "hifi-4", "pop": "hifi-5" }`


    mappingStrB, err := os.ReadFile("/home/ubuntu/spatial-audio-room/token-server/channel-name-mapping.json")
    if err != nil {
        fmt.Print(err)
		return "hifi-demo";
    }
    mappingStr := string(mappingStrB)


    demoGroupToAgoraChannel := map[string]string{}
    json.Unmarshal([]byte(mappingStr), &demoGroupToAgoraChannel)

	agoraChannelPrefix, found := demoGroupToAgoraChannel[ demoGroupName ]
	if (!found) {
		agoraChannelPrefix = "hifi-demo";
	}

	return agoraChannelPrefix;
}


func handleTokenRequest(dat map[string]interface{}) map[string]interface{} {

	var role_num uint32 = uint32(dat["token-role"].(float64))
	var agora_channel string = dat["agora-channel-name"].(string)

	var role rtctokenbuilder.Role
	switch role_num {
	case 0: role = rtctokenbuilder.RoleAttendee
	case 1: role = rtctokenbuilder.RolePublisher
	case 2: role = rtctokenbuilder.RoleSubscriber
	case 101: role = rtctokenbuilder.RoleAdmin
	}

	var int_uid uint32 = 0
	if _, ok := dat["uid"]; ok {

		num_uid, ok := dat["uid"].(float64);
		if ok {
			int_uid = uint32(num_uid);
		} else {
			id, err := strconv.Atoi(dat["uid"].(string));
			checkError(err);
			int_uid = uint32(id);
		}
	}

	var expireTimeInSeconds uint32 = 86400
	if _, ok := dat["timeout"]; ok {
		expireTimeInSeconds = uint32(dat["timeout"].(float64))
	}

	var rtc_token = generateRtcToken(int_uid, agora_channel, role, expireTimeInSeconds)

	var response map[string]interface{} = make(map[string]interface{})
	response["message-type"] = "new-agora-token"
	response["token"] = rtc_token

	return response;
}



var websockets map[*websocket.Conn]uint32 = make(map[*websocket.Conn]uint32)
var currentRoomID string
var nthConnect uint32


var upgrader = websocket.Upgrader{
	EnableCompression: true,
	CheckOrigin: func(r *http.Request) bool { return true }}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	checkError(err)
	keepAlive(c, 30 * time.Second)
	defer c.Close()

	websockets[c] = nthConnect
	nthConnect++;
	nthConnect = nthConnect % 8;

	var thisUID string = ""
	var currentChannel string = ""

	for {
		_, message, err := c.ReadMessage()

		if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
			log.Printf("closing websocket -- normal close\n")
			break;
		}
		if websocket.IsCloseError(err, websocket.CloseAbnormalClosure) {
			log.Printf("closing websocket -- abnormal close\n")
			break;
		}
		if err != nil {
			log.Printf("websocket connection -- failed: %s\n", err.Error())
			break;
		}

		// if mt == websocket.TextMessage {
		// 	log.Println("got text message websocket: ", string(message))
		// } else if mt == websocket.BinaryMessage {
		// 	log.Println("got binary message websocket: ", string(message))
		// } else {
		// 	log.Println("got mt: ", mt)
		// }

		var dat map[string]interface{}

		if err := json.Unmarshal(message, &dat); err != nil {
			panic(err)
		}

		msgType := dat["message-type"].(string)

		if (msgType == "get-agora-token") {
			var response = handleTokenRequest(dat)
			data, _ := json.Marshal(response)
			c.WriteMessage(websocket.TextMessage, data)
		}

		if (msgType == "get-channel-prefix") {
			var demoGroupName = dat["demo-group-name"].(string)
			var response map[string]interface{} = make(map[string]interface{})
			response["message-type"] = "set-channel-prefix"
			response["channel-prefix"] = getAgoraChannelPrefixFromDemoGroup(demoGroupName);
			data, _ := json.Marshal(response)
			c.WriteMessage(websocket.TextMessage, data)
		}

		if (msgType == "join-room") {
			var channelAndRoom = dat["room"].(string)
			s := strings.Split(channelAndRoom, ":")
			currentRoomID = s[1]
		}

		if (msgType == "get-current-room" || msgType == "join-room") {
			var response map[string]interface{} = make(map[string]interface{})
			response["message-type"] = "join-room"
			response["room"] = currentRoomID
			response["nth"] = websockets[c]
			data, _ := json.Marshal(response)
			for ws, _ := range websockets {
				ws.WriteMessage(websocket.TextMessage, data)
			}
		}


		// peer-to-peer messages
		if (msgType == "join-p2p-channel") {
			var uid = dat["uid"].(string)
			var channelName = dat["channel"].(string)
			p2pClient := P2PClient{ uid, c, &sync.Mutex{} }

			if (currentChannel != "") {
				var channelClients = p2pChannels[ currentChannel ]
				for otherUID, otherP2PClient := range channelClients {
					if (thisUID == otherUID) {
						continue;
					}

					{
						log.Printf("p2p telling %v to unsubscribe from %v\n", otherP2PClient.uid, thisUID);
						var response map[string]interface{} = make(map[string]interface{})
						response["message-type"] = "disconnect-from-peer"
						response["uid"] = thisUID
						data, _ := json.Marshal(response)
						otherP2PClient.websocketConnection.WriteMessage(websocket.TextMessage, data)
					}
				}

			}

			thisUID = uid;
			currentChannel = channelName;

			p2pClients[ uid ] = &p2pClient

			if channel, ok := p2pChannels[ channelName ]; ok {
				channel[ uid ] = &p2pClient
			} else {
				p2pChannels[ channelName ] = make(map[string]*P2PClient)
				p2pChannels[ channelName ][ uid ] = &p2pClient
			}

			log.Printf("got join-p2p-channel uid=%v channelName=%v\n", uid, channelName);

			var channelClients = p2pChannels[ channelName ]

			for uid, _ := range channelClients {
				for otherUID, otherP2PClient := range channelClients {
					if (uid == otherUID) {
						continue;
					}

					{
						log.Printf("p2p telling %v to contact %v\n", otherP2PClient.uid, uid);
						var response map[string]interface{} = make(map[string]interface{})
						response["message-type"] = "connect-with-peer"
						response["uid"] = uid
						data, _ := json.Marshal(response)
						otherP2PClient.websocketConnection.WriteMessage(websocket.TextMessage, data)
					}

					{
						log.Printf("p2p telling %v to contact %v\n", uid, otherP2PClient.uid);
						var response map[string]interface{} = make(map[string]interface{})
						response["message-type"] = "connect-with-peer"
						response["uid"] = otherUID
						data, _ := json.Marshal(response)
						c.WriteMessage(websocket.TextMessage, data)
					}
				}
			}

		}

		if (msgType == "ice-candidate" || msgType == "sdp") {
			var fromUID = dat["from-uid"].(string)
			var toUID = dat["to-uid"].(string)

			log.Printf("%v from %v to %v\n", msgType, fromUID, toUID);

			if p2pClient, ok := p2pClients[ toUID ]; ok {
				p2pClient.websocketConnection.WriteMessage(websocket.TextMessage, message)
			} else {
				log.Printf("error -- can't find recipient of ice-candidate -- from %v to %v\n", fromUID, toUID);
			}
		}
	}

	delete(websockets, c)

	for uid, p2pClient := range p2pClients {
		if (p2pClient.websocketConnection == c) {
			delete(p2pClients, uid);
		}
	}

	for _, channelClients := range p2pChannels {
		for uid, p2pClient := range channelClients {
			if (p2pClient.websocketConnection == c) {
				delete(channelClients, uid);
			}
		}
	}

	var channelClients = p2pChannels[ currentChannel ]
	for otherUID, otherP2PClient := range channelClients {
		if (thisUID == otherUID) {
			continue;
		}

		{
			log.Printf("p2p telling %v to unsubscribe from %v\n", otherP2PClient.uid, thisUID);
			var response map[string]interface{} = make(map[string]interface{})
			response["message-type"] = "disconnect-from-peer"
			response["uid"] = thisUID
			data, _ := json.Marshal(response)
			otherP2PClient.websocketConnection.WriteMessage(websocket.TextMessage, data)
		}
	}
}


func tokenHTTPHandler(w http.ResponseWriter, r *http.Request) {

	if r.Method != "POST" {
		wsHandler(w, r)
		return
	}

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var dat map[string]interface{}
	if err = json.Unmarshal(body, &dat); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var response = handleTokenRequest(dat)
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(response["token"].(string)))
}


var addr = flag.String("addr", "0.0.0.0:4440", "hostname:port")

func main(){
	flag.Parse()
	log.Printf("websocket listening on %v\n", *addr)

	log.SetFlags(0)
	http.HandleFunc("/", tokenHTTPHandler)
	err := http.ListenAndServe(*addr, nil)
	log.Fatal(err)
}
