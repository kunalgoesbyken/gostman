package mock

import (
	"context"
	"net/http"
	"time"
)

type Dice struct {
	chance *chance
}

func NewDice(first, second uint64) *Dice {
	return &Dice{chance: newChance(first, second)}
}

func (d *Dice) Roll(percent int) bool {
	return d.chance.roll(percent)
}

func (d *Dice) Between(low, high int) int {
	return d.chance.between(low, high)
}

func (f Fault) Check() error {
	return f.validate()
}

func (f Fault) Mode() string {
	return f.kind()
}

func (f Fault) Code() int {
	return f.status()
}

func Drop(w http.ResponseWriter, reset bool) bool {
	return drop(w, reset)
}

func Pause(ctx context.Context, delay time.Duration) bool {
	return wait(ctx, delay)
}
