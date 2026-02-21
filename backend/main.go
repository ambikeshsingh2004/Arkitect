package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"arkitect/engine"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	sessionMgr = engine.NewSessionManager()
	upgrader   = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true }, // Allow all origins for dev
	}
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/simulate", handleSimulate)
	mux.HandleFunc("/api/ws/", handleWebSocket)
	mux.HandleFunc("/api/simulate/", handleSessionAction)

	// CORS middleware
	handler := corsMiddleware(mux)

	log.Println("Arkitect backend starting on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// corsMiddleware adds CORS headers for local development.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// POST /api/simulate — start a new simulation
func handleSimulate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config engine.ArchitectureConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	sessionID := uuid.New().String()[:8]
	configJSON, _ := json.Marshal(config)

	session, err := sessionMgr.Create(sessionID, configJSON)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to start simulation: %v", err), http.StatusBadRequest)
		return
	}

	_ = session
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"sessionId": sessionID,
		"wsUrl":     fmt.Sprintf("ws://%s/api/ws/%s", r.Host, sessionID),
	})
}

// GET /api/ws/{sessionId} — WebSocket for streaming metrics
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/ws/"), "/")
	sessionID := parts[0]

	session, ok := sessionMgr.Get(sessionID)
	if !ok {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("WebSocket connected for session %s", sessionID)

	// Stream tick results to the WebSocket client
	for result := range session.Simulator.Output() {
		data, err := json.Marshal(result)
		if err != nil {
			log.Printf("JSON marshal error: %v", err)
			continue
		}
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("WebSocket write error: %v", err)
			return
		}
	}

	log.Printf("WebSocket closed for session %s", sessionID)
}

// POST /api/simulate/{sessionId}/stop or /traffic
func handleSessionAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse: /api/simulate/{sessionId}/{action}
	path := strings.TrimPrefix(r.URL.Path, "/api/simulate/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	sessionID := parts[0]
	action := parts[1]

	switch action {
	case "stop":
		if err := sessionMgr.Stop(sessionID); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})

	case "traffic":
		session, ok := sessionMgr.Get(sessionID)
		if !ok {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		var body struct {
			RPS   float64 `json:"rps"`
			Spike *bool   `json:"spike,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}
		if body.RPS > 0 {
			session.Simulator.SetTrafficRPS(body.RPS)
		}
		if body.Spike != nil {
			session.Simulator.SetSpike(*body.Spike)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "updated"})

	case "toggle":
		session, ok := sessionMgr.Get(sessionID)
		if !ok {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		var body struct {
			NodeID string `json:"nodeId"`
			Down   bool   `json:"down"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}
		if !session.Simulator.SetNodeDown(body.NodeID, body.Down) {
			http.Error(w, "Node not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "toggled"})

	case "config":
		session, ok := sessionMgr.Get(sessionID)
		if !ok {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		var body struct {
			NodeID           string  `json:"nodeId"`
			MaxRPS           float64 `json:"maxRPS,omitempty"`
			BaseLatency      float64 `json:"baseLatency,omitempty"`
			RPS              float64 `json:"rps,omitempty"` // for client node traffic
			Algorithm        string  `json:"algorithm,omitempty"`
			ReadRatio        float64 `json:"readRatio,omitempty"`
			ConcurrencyLimit float64 `json:"concurrencyLimit,omitempty"`
			IsReplica        *bool   `json:"isReplica,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}
		// If RPS is set, update the simulator traffic
		if body.RPS > 0 {
			session.Simulator.SetTrafficRPS(body.RPS)
		}
		ir := false
		if body.IsReplica != nil {
			ir = *body.IsReplica
		}
		if body.MaxRPS > 0 || body.BaseLatency > 0 || body.Algorithm != "" || body.ReadRatio > 0 || body.ConcurrencyLimit > 0 || body.IsReplica != nil || body.RPS > 0 {
			if !session.Simulator.UpdateNodeConfig(body.NodeID, body.MaxRPS, body.BaseLatency, body.ReadRatio, body.ConcurrencyLimit, body.RPS, ir, body.Algorithm) {
				// Not an error for client/LB nodes — just skip
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "configured"})

	case "update-graph":
		session, ok := sessionMgr.Get(sessionID)
		if !ok {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		var config engine.ArchitectureConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}

		// Debug log
		log.Printf("Simulation Update: NodeCount=%d", len(config.Nodes))
		for _, n := range config.Nodes {
			if n.Type == "client" {
				log.Printf("  Client node found: %s, RPS=%.1f", n.ID, n.RPS)
			}
		}
		newGraph, err := engine.BuildGraphFromConfig(&config)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to rebuild graph: %v", err), http.StatusBadRequest)
			return
		}
		session.Simulator.UpdateGraph(newGraph)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "graph_updated"})

	case "reset-queues":
		session, ok := sessionMgr.Get(sessionID)
		if !ok {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		session.Simulator.ResetQueues()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "queues_reset"})

	default:
		http.Error(w, "Unknown action", http.StatusBadRequest)
	}
}
