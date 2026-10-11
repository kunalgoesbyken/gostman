package capture

import (
	"slices"
	"sync"
)

const (
	journalLimit = 500
	journalBytes = 128 << 20
)

type Journal struct {
	mu        sync.Mutex
	exchanges []Exchange
	held      int
	lastID    int64
}

func weightOf(exchange Exchange) int {
	return len(exchange.Request.Body) + len(exchange.Response.Body)
}

func (j *Journal) trim() {
	excess := 0
	for len(j.exchanges)-excess > journalLimit || (j.held > journalBytes && len(j.exchanges)-excess > 1) {
		j.held -= weightOf(j.exchanges[excess])
		excess++
	}
	if excess > 0 {
		j.exchanges = slices.Clone(j.exchanges[excess:])
	}
}

func (j *Journal) Add(exchange Exchange) Exchange {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.lastID++
	exchange.ID = j.lastID
	j.exchanges = append(j.exchanges, exchange)
	j.held += weightOf(exchange)
	j.trim()
	return exchange
}

func (j *Journal) Summaries() []Exchange {
	j.mu.Lock()
	defer j.mu.Unlock()
	summaries := make([]Exchange, 0, len(j.exchanges))
	for _, exchange := range j.exchanges {
		summaries = append(summaries, exchange.Summary())
	}
	return summaries
}

func (j *Journal) Find(ids []int64) []Exchange {
	j.mu.Lock()
	defer j.mu.Unlock()
	found := make([]Exchange, 0, len(ids))
	for _, exchange := range j.exchanges {
		if slices.Contains(ids, exchange.ID) {
			found = append(found, exchange)
		}
	}
	return found
}

func (j *Journal) Clear() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.exchanges = nil
	j.held = 0
}
