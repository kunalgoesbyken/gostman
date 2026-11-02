package main

import (
	"errors"
	"os"

	"github.com/kunalgoesbyken/gostman/monitor"
)

const monitorWebhookPrefix = "monitor-webhook:"

func monitorStore(scope string, keep int) (monitor.Store, error) {
	if scope == "" {
		scope = appFolder
	}
	return monitor.Open(scope, keep)
}

func (a *App) MonitorRuns(scope string) ([]monitor.Record, error) {
	store, err := monitorStore(scope, monitor.DefaultKeep)
	if err != nil {
		return nil, err
	}
	return store.List(0)
}

func (a *App) SaveMonitorRun(scope string, record monitor.Record, keep int) error {
	if record.ID == "" {
		return errors.New("the run has no id")
	}
	store, err := monitorStore(scope, keep)
	if err != nil {
		return err
	}
	return store.Save(record)
}

func (a *App) ForgetMonitorRuns(scope string) error {
	store, err := monitorStore(scope, monitor.DefaultKeep)
	if err != nil {
		return err
	}
	return os.RemoveAll(store.Dir)
}

func (a *App) SaveMonitorWebhook(id, address string) error {
	if err := (monitor.Notifier{Address: address}).Validate(); err != nil {
		return err
	}
	return vault.set(monitorWebhookPrefix+id, address)
}

func (a *App) HasMonitorWebhook(id string) bool {
	_, found := vault.get(monitorWebhookPrefix + id)
	return found
}

func (a *App) DeleteMonitorWebhook(id string) error {
	return vault.remove(monitorWebhookPrefix + id)
}

func (a *App) NotifyMonitor(id string, notice monitor.Notice) error {
	address, found := vault.get(monitorWebhookPrefix + id)
	if !found {
		return errors.New("this monitor has no notification address")
	}
	return monitor.Notifier{Address: address, Transport: a.policy().Transport(false)}.Post(a.ctx, notice)
}
