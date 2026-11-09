package main

const (
	minRememberedSide = 200
	minVisibleWidth   = 120
	minVisibleHeight  = 16
)

type windowRect struct {
	Left, Top, Right, Bottom int
}

func (r windowRect) width() int  { return r.Right - r.Left }
func (r windowRect) height() int { return r.Bottom - r.Top }

func (r windowRect) overlap(other windowRect) windowRect {
	return windowRect{
		Left:   max(r.Left, other.Left),
		Top:    max(r.Top, other.Top),
		Right:  min(r.Right, other.Right),
		Bottom: min(r.Bottom, other.Bottom),
	}
}

func (r windowRect) shifted(dx, dy int) windowRect {
	return windowRect{Left: r.Left + dx, Top: r.Top + dy, Right: r.Right + dx, Bottom: r.Bottom + dy}
}

func (r windowRect) empty() bool { return r.width() <= 0 || r.height() <= 0 }

func (r windowRect) area() int {
	if r.empty() {
		return 0
	}
	return r.width() * r.height()
}

func (r windowRect) centredIn(area windowRect) windowRect {
	left := area.Left + (area.width()-r.width())/2
	top := area.Top + (area.height()-r.height())/2
	return windowRect{Left: left, Top: top, Right: left + r.width(), Bottom: top + r.height()}
}

func (r windowRect) insideOf(area windowRect) windowRect {
	width := min(r.width(), area.width())
	height := min(r.height(), area.height())
	left := min(max(r.Left, area.Left), area.Right-width)
	top := min(max(r.Top, area.Top), area.Bottom-height)
	return windowRect{Left: left, Top: top, Right: left + width, Bottom: top + height}
}

func mostlyShown(rect windowRect, area windowRect) bool {
	visible := rect.overlap(area)
	return visible.width() >= minVisibleWidth && visible.height() >= minVisibleHeight
}

func areaShowingMost(rect windowRect, areas []windowRect) (windowRect, bool) {
	best, bestArea := windowRect{}, 0
	for _, area := range areas {
		if !mostlyShown(rect, area) {
			continue
		}
		if shared := rect.overlap(area).area(); shared > bestArea {
			best, bestArea = area, shared
		}
	}
	return best, bestArea > 0
}

func fitWindow(rect windowRect, placed bool, areas []windowRect) (windowRect, bool) {
	if len(areas) == 0 {
		return rect, placed
	}
	if placed {
		if area, shown := areaShowingMost(rect, areas); shown {
			return rect.insideOf(area), true
		}
	}
	size := windowRect{Right: min(rect.width(), areas[0].width()), Bottom: min(rect.height(), areas[0].height())}
	return size.centredIn(areas[0]), false
}

func plausibleWindow(rect windowRect) bool {
	return rect.width() >= minRememberedSide && rect.height() >= minRememberedSide &&
		rect.width() <= maxWindowSide && rect.height() <= maxWindowSide
}
