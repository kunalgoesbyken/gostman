package capture

import (
	"slices"
	"sync"
)

const journalLimit = 500

type Journal struct {
	mu        sync.Mutex
	exchanges []Exchange
	lastID    int64
}

func (j *Journal) Add(exchange Exchange) Exchange {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.lastID++
	exchange.ID = j.lastID
	j.exchanges = append(j.exchanges, exchange)
	if excess := len(j.exchanges) - journalLimit; excess > 0 {
		j.exchanges = slices.Clone(j.exchanges[excess:])
	}
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
}
