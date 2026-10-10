package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	wsStateEventName   = "ws:state"
	wsMessageEventName = "ws:message"
)

type WSStateEvent struct {
	ConnectionId string `json:"connectionId"`
	State        string `json:"state"`
	Detail       string `json:"detail"`
}

type WSMessageEvent struct {
	ConnectionId string `json:"connectionId"`
	Data         string `json:"data"`
	Binary       bool   `json:"binary"`
}

type wsConn struct {
	conn       *websocket.Conn
	writeMutex sync.Mutex
	closeOnce  sync.Once
}

var (
	wsMutex       sync.Mutex
	wsConnections = map[string]*wsConn{}
)

func (a *App) WSConnect(urlStr, headersJSON string) (string, error) {
	header, err := parseWSHeaders(headersJSON)
	if err != nil {
		return "", err
	}

	id := uuid.NewString()
	a.emitWSState(id, "connecting", urlStr)

	conn, resp, err := websocket.DefaultDialer.DialContext(a.ctx, urlStr, header)
	if err != nil {
		detail := err.Error()
		if resp != nil {
			resp.Body.Close()
			detail = fmt.Sprintf("%s (HTTP %s)", detail, resp.Status)
		}
		a.emitWSState(id, "error", detail)
		return "", fmt.Errorf("websocket dial failed: %w", err)
	}

	c := &wsConn{conn: conn}
	wsMutex.Lock()
	wsConnections[id] = c
	wsMutex.Unlock()

	a.emitWSState(id, "open", urlStr)
	go a.readLoop(id, c)

	return id, nil
}

func (a *App) WSSend(id, message string) error {
	c := lookupWSConn(id)
	if c == nil {
		return fmt.Errorf("websocket %s is not connected", id)
	}

	c.writeMutex.Lock()
	defer c.writeMutex.Unlock()
	return c.conn.WriteMessage(websocket.TextMessage, []byte(message))
}

func (a *App) WSClose(id string) error {
	c := takeWSConn(id)
	if c == nil {
		return nil
	}
	a.shutdown(id, c, "closed by client")
	return nil
}

func (a *App) readLoop(id string, c *wsConn) {
	for {
		kind, data, err := c.conn.ReadMessage()
		if err != nil {
			takeWSConn(id)
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				a.emitWSState(id, "error", err.Error())
			}
			a.shutdown(id, c, "connection closed by peer")
			return
		}
		wailsruntime.EventsEmit(a.ctx, wsMessageEventName, frameEvent(id, kind, data))
	}
}

func frameEvent(id string, kind int, data []byte) WSMessageEvent {
	if kind == websocket.BinaryMessage {
		return WSMessageEvent{ConnectionId: id, Data: base64.StdEncoding.EncodeToString(data), Binary: true}
	}
	return WSMessageEvent{ConnectionId: id, Data: string(data)}
}

func (a *App) shutdown(id string, c *wsConn, detail string) {
	c.closeOnce.Do(func() {
		c.writeMutex.Lock()
		c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		c.writeMutex.Unlock()
		c.conn.Close()
		a.emitWSState(id, "closed", detail)
	})
}

func (a *App) emitWSState(id, state, detail string) {
	wailsruntime.EventsEmit(a.ctx, wsStateEventName, WSStateEvent{ConnectionId: id, State: state, Detail: detail})
}

func lookupWSConn(id string) *wsConn {
	wsMutex.Lock()
	defer wsMutex.Unlock()
	return wsConnections[id]
}

func takeWSConn(id string) *wsConn {
	wsMutex.Lock()
	defer wsMutex.Unlock()
	c, ok := wsConnections[id]
	if !ok {
		return nil
	}
	delete(wsConnections, id)
	return c
}

func parseWSHeaders(headersJSON string) (http.Header, error) {
	if headersJSON == "" {
		return nil, nil
	}
	var raw map[string]string
	if err := json.Unmarshal([]byte(headersJSON), &raw); err != nil {
		return nil, fmt.Errorf("invalid headers JSON: %w", err)
	}
	header := http.Header{}
	for name, value := range raw {
		if name != "" && value != "" {
			header.Set(name, value)
		}
	}
	return header, nil
}
