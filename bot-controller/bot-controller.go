
package main

import (
	"fmt"
	"log"
	"net/http"
	"encoding/json"
)


func httpHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=UTF-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS");
	w.Header().Set("Access-Control-Allow-Headers", "*");

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" && r.Method != "OPTIONS" {
		http.Error(w, "Unsupported method.", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	resp := make(map[string]string)
	resp["success"] = "ok";
	jsonResp, _ := json.Marshal(resp)
	w.Write(jsonResp)
}

func main(){
	http.HandleFunc("/bots", httpHandler)
	fmt.Printf("Starting server at port 8070\n")
	if err := http.ListenAndServe(":8070", nil); err != nil {
		log.Fatal(err)
	}
}
