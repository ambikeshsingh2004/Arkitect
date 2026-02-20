package engine

import (
	"fmt"
	"sync"
)

// Session represents a running simulation session.
type Session struct {
	ID        string
	Simulator *Simulator
}

// SessionManager manages active simulation sessions.
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

// NewSessionManager creates a new session manager.
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
	}
}

// Create builds a graph from config and starts a new simulation session.
func (sm *SessionManager) Create(id string, configJSON []byte) (*Session, error) {
	graph, err := BuildGraph(configJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to build graph: %w", err)
	}

	sim := NewSimulator(graph)
	session := &Session{
		ID:        id,
		Simulator: sim,
	}

	sm.mu.Lock()
	// Stop any existing session with same ID
	if existing, ok := sm.sessions[id]; ok {
		existing.Simulator.Stop()
	}
	sm.sessions[id] = session
	sm.mu.Unlock()

	sim.Start()
	return session, nil
}

// Get retrieves a session by ID.
func (sm *SessionManager) Get(id string) (*Session, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	s, ok := sm.sessions[id]
	return s, ok
}

// Stop stops and removes a session.
func (sm *SessionManager) Stop(id string) error {
	sm.mu.Lock()
	session, ok := sm.sessions[id]
	if !ok {
		sm.mu.Unlock()
		return fmt.Errorf("session not found: %s", id)
	}
	delete(sm.sessions, id)
	sm.mu.Unlock()

	session.Simulator.Stop()
	return nil
}
