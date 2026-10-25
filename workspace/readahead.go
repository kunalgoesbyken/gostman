package workspace

import (
	"io/fs"
	"runtime"
	"sync"
)

const (
	minReaders = 4
	maxReaders = 32
)

type pending struct {
	done    chan struct{}
	entries []fs.DirEntry
	content []byte
	request decodedRequest
	err     error
}

type readAhead struct {
	disk          disk
	flowsReserved bool
	slots         chan struct{}
	mu            sync.Mutex
	listings      map[string]*pending
	files         map[string]*pending
}

func readers() int {
	return min(max(runtime.NumCPU()*2, minReaders), maxReaders)
}

func startReadAhead(storage disk) *readAhead {
	ahead := &readAhead{
		disk:          storage,
		flowsReserved: !flowsHoldRequests(storage),
		slots:         make(chan struct{}, readers()),
		listings:      map[string]*pending{},
		files:         map[string]*pending{},
	}
	ahead.survey("", 0)
	return ahead
}

func (a *readAhead) spawn(table map[string]*pending, key string, work func(*pending)) {
	job := &pending{done: make(chan struct{})}
	a.mu.Lock()
	table[key] = job
	a.mu.Unlock()
	go func() {
		a.slots <- struct{}{}
		work(job)
		<-a.slots
		close(job.done)
	}()
}

func (a *readAhead) survey(directory string, depth int) {
	a.spawn(a.listings, directory, func(job *pending) {
		job.entries, job.err = a.list(directory)
		for _, entry := range job.entries {
			relative := joinPath(directory, entry.Name())
			switch kindOf(directory, entry, a.flowsReserved) {
			case requestKind:
				a.readRequest(relative)
			case folderKind:
				a.readFolderFile(joinPath(relative, FolderFileName))
				if depth < maxFolderDepth {
					a.survey(relative, depth+1)
				}
			}
		}
	})
}

func (a *readAhead) list(directory string) ([]fs.DirEntry, error) {
	if directory == "" {
		return a.disk.list(directory)
	}
	return a.disk.listWalked(directory)
}

func (a *readAhead) readRequest(relative string) {
	a.spawn(a.files, relative, func(job *pending) {
		content, err := a.disk.readListed(relative)
		job.request.document, job.request.err = decodeFile(content, err, readRequestFile)
	})
}

func (a *readAhead) readFolderFile(relative string) {
	a.spawn(a.files, relative, func(job *pending) {
		job.content, job.err = a.disk.readWalked(relative)
	})
}

func (a *readAhead) wait(table map[string]*pending, key string) *pending {
	a.mu.Lock()
	job := table[key]
	a.mu.Unlock()
	<-job.done
	return job
}

func (a *readAhead) listing(directory string) *pending {
	return a.wait(a.listings, directory)
}

func (a *readAhead) file(relative string) *pending {
	return a.wait(a.files, relative)
}
