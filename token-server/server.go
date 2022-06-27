// https://docs.agora.io/en/Interactive%20Broadcast/token_server

package main

import (
	"flag"
	"fmt"
	"log"
	"strings"
	"net/http"
	"time"
	"encoding/json"
	"github.com/gorilla/websocket"
	rtctokenbuilder "github.com/AgoraIO/Tools/DynamicKey/AgoraDynamicKey/go/src/RtcTokenBuilder"
)

func checkError(err error) {
	if err != nil {
		panic(err)
	}
}


// Use RtcTokenBuilder to generate an RTC token.
func generateRtcToken(int_uid uint32, channelName string, role rtctokenbuilder.Role) string {

	appID := "aee8658414ec41a4a5d97a79ddf86bd7"
	appCertificate := "f01f7d954f614a508ae81a672e8cd557"
	// Number of seconds after which the token expires.
	// expireTimeInSeconds := uint32(3600)
	expireTimeInSeconds := uint32(120)
	// Get current timestamp.
	currentTimestamp := uint32(time.Now().UTC().Unix())
	// Timestamp when the token expires.
	expireTimestamp := currentTimestamp + expireTimeInSeconds

	result, err := rtctokenbuilder.BuildTokenWithUID(appID, appCertificate, channelName, int_uid, role, expireTimestamp)
	if err != nil {
		fmt.Println(err)
	} else {
		fmt.Printf("Token with uid: %s\n", result)
		fmt.Printf("uid is %d\n", int_uid )
		fmt.Printf("ChannelName is %s\n", channelName)
		fmt.Printf("Role is %d\n", role)
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


var websockets map[*websocket.Conn]bool = make(map[*websocket.Conn]bool)

var upgrader = websocket.Upgrader{
	EnableCompression: true,
	CheckOrigin: func(r *http.Request) bool { return true }}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	checkError(err)
	keepAlive(c, 30 * time.Second)
	defer c.Close()

	websockets[c] = true

	for {
		mt, message, err := c.ReadMessage()

		if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
			log.Printf("closing websocket -- normal close");
			delete(websockets, c)
			return
		}
		if websocket.IsCloseError(err, websocket.CloseAbnormalClosure) {
			log.Printf("closing websocket -- abnormal close");
			delete(websockets, c)
			return
		}
		if err != nil {
			log.Printf("websocket connection -- failed: %s\n", err.Error())
			delete(websockets, c)
			return
		}

		if mt == websocket.TextMessage {
			log.Println("got text message websocket: ", string(message))
		} else if mt == websocket.BinaryMessage {
			log.Println("got binary message websocket: ", string(message))
		} else {
			log.Println("got mt: ", mt)
		}

		var dat map[string]interface{}

		if err := json.Unmarshal(message, &dat); err != nil {
			panic(err)
		}
		fmt.Println(dat)

		msgType := dat["message-type"].(string)
		fmt.Println("message-type = ", msgType)

		if (msgType == "get-agora-token") {

			var role_num uint32 = uint32(dat["token-role"].(float64))
			var int_uid uint32 = uint32(dat["uid"].(float64))
			var agora_channel string = dat["agora-channel-name"].(string)

			var role rtctokenbuilder.Role
			switch role_num {
			case 0: role = rtctokenbuilder.RoleAttendee
			case 1: role = rtctokenbuilder.RolePublisher
			case 2: role = rtctokenbuilder.RoleSubscriber
			case 101: role = rtctokenbuilder.RoleAdmin
			}

			var rtc_token = generateRtcToken(int_uid, agora_channel, role)

			var response map[string]interface{} = make(map[string]interface{})
			response["message-type"] = "new-agora-token"
			response["token"] = rtc_token;

			data, _ := json.Marshal(response)
			c.WriteMessage(websocket.TextMessage, data)
		} else if (msgType == "join-room") {
			var response map[string]interface{} = make(map[string]interface{})
			response["message-type"] = "join-room"
			var channelAndRoom = dat["room"].(string)
			s := strings.Split(channelAndRoom, ":")
			response["room"] = s[1]
			data, _ := json.Marshal(response)

			for ws, _ := range websockets {
				ws.WriteMessage(websocket.TextMessage, data)
			}
		}
	}
}



var addr = flag.String("addr", "0.0.0.0:4440", "hostname:port")

func main(){
	flag.Parse()
	log.Printf("websocket listening on %v\n", *addr)

	log.SetFlags(0)
	http.HandleFunc("/", wsHandler)
	err := http.ListenAndServe(*addr, nil)
	log.Fatal(err);
}
