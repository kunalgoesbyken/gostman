//go:build linux

package main

/*
#cgo pkg-config: gtk+-3.0
#include <string.h>
#include <gtk/gtk.h>

#define MAX_AREAS 32
#define SETTLE_MILLIS 200

typedef struct {
	int x, y, width, height;
} Box;

typedef struct {
	int count;
	Box boxes[MAX_AREAS];
} Areas;

typedef struct {
	int found, maximised, plain, trackedKnown;
	Box live, tracked, monitor;
} Snapshot;

typedef struct {
	Box target;
	int maximise;
} Placement;

static GMutex callLock;
static GCond callDone;

typedef struct {
	GSourceFunc run;
	gpointer data;
	gboolean finished;
} MainCall;

static gboolean runMainCall(gpointer data) {
	MainCall *call = data;
	call->run(call->data);
	g_mutex_lock(&callLock);
	call->finished = TRUE;
	g_cond_broadcast(&callDone);
	g_mutex_unlock(&callLock);
	return G_SOURCE_REMOVE;
}

static void callOnMainThread(GSourceFunc run, gpointer data) {
	if (g_main_context_is_owner(g_main_context_default())) {
		run(data);
		return;
	}
	MainCall call = {run, data, FALSE};
	g_idle_add(runMainCall, &call);
	g_mutex_lock(&callLock);
	while (!call.finished) {
		g_cond_wait(&callDone, &callLock);
	}
	g_mutex_unlock(&callLock);
}

static struct {
	GtkWindow *window;
	Box bounds;
	gboolean known;
	gboolean maximiseWhenSettled;
	guint timer;
} watched;

static Box boxOf(GdkRectangle rectangle) {
	Box box = {rectangle.x, rectangle.y, rectangle.width, rectangle.height};
	return box;
}

static gboolean onWayland(void) {
	GdkDisplay *display = gdk_display_get_default();
	return display != NULL && g_strcmp0(G_OBJECT_TYPE_NAME(display), "GdkWaylandDisplay") == 0;
}

static GtkWindow *findMainWindow(void) {
	GtkWindow *found = NULL;
	GList *toplevels = gtk_window_list_toplevels();
	for (GList *item = toplevels; item != NULL && found == NULL; item = item->next) {
		GtkWindow *window = GTK_WINDOW(item->data);
		if (gtk_window_get_window_type(window) == GTK_WINDOW_TOPLEVEL &&
			gtk_window_get_transient_for(window) == NULL &&
			gtk_widget_get_window(GTK_WIDGET(window)) != NULL) {
			found = window;
		}
	}
	g_list_free(toplevels);
	return found;
}

static GtkWindow *mainWindow(void) {
	return watched.window != NULL ? watched.window : findMainWindow();
}

static GdkWindowState stateOf(GtkWindow *window) {
	return gdk_window_get_state(gtk_widget_get_window(GTK_WIDGET(window)));
}

static gboolean isPlain(GtkWindow *window) {
	GdkWindowState apart = GDK_WINDOW_STATE_MAXIMIZED | GDK_WINDOW_STATE_FULLSCREEN |
		GDK_WINDOW_STATE_ICONIFIED | GDK_WINDOW_STATE_TILED;
	return (stateOf(window) & apart) == 0;
}

static Box liveBounds(GtkWindow *window) {
	Box box;
	gtk_window_get_position(window, &box.x, &box.y);
	gtk_window_get_size(window, &box.width, &box.height);
	return box;
}

static void sampleBounds(GtkWindow *window) {
	if (isPlain(window)) {
		watched.bounds = liveBounds(window);
		watched.known = TRUE;
	}
}

static gboolean settled(gpointer unused) {
	watched.timer = 0;
	if (watched.maximiseWhenSettled) {
		watched.maximiseWhenSettled = FALSE;
		gtk_window_maximize(watched.window);
	} else {
		sampleBounds(watched.window);
	}
	return G_SOURCE_REMOVE;
}

static void settleSoon(void) {
	if (watched.timer != 0) {
		g_source_remove(watched.timer);
	}
	watched.timer = g_timeout_add(SETTLE_MILLIS, settled, NULL);
}

static gboolean onConfigure(GtkWidget *widget, GdkEventConfigure *event, gpointer unused) {
	settleSoon();
	return FALSE;
}

static gboolean watchMainWindow(gpointer unused) {
	GtkWindow *window = mainWindow();
	if (window == NULL || watched.window == window) {
		return G_SOURCE_REMOVE;
	}
	watched.window = window;
	g_signal_connect(window, "configure-event", G_CALLBACK(onConfigure), NULL);
	sampleBounds(window);
	return G_SOURCE_REMOVE;
}

static void addArea(Areas *areas, GdkMonitor *monitor) {
	if (areas->count >= MAX_AREAS) {
		return;
	}
	GdkRectangle workarea;
	gdk_monitor_get_workarea(monitor, &workarea);
	areas->boxes[areas->count++] = boxOf(workarea);
}

static gboolean collectAreas(gpointer data) {
	Areas *areas = data;
	GdkDisplay *display = gdk_display_get_default();
	if (display == NULL) {
		return G_SOURCE_REMOVE;
	}
	int monitors = gdk_display_get_n_monitors(display);
	for (int primary = 1; primary >= 0; primary--) {
		for (int index = 0; index < monitors; index++) {
			GdkMonitor *monitor = gdk_display_get_monitor(display, index);
			if (gdk_monitor_is_primary(monitor) == primary) {
				addArea(areas, monitor);
			}
		}
	}
	return G_SOURCE_REMOVE;
}

static gboolean placeMainWindow(gpointer data) {
	Placement *placement = data;
	GtkWindow *window = mainWindow();
	if (window == NULL) {
		return G_SOURCE_REMOVE;
	}
	watchMainWindow(NULL);
	gtk_window_resize(window, placement->target.width, placement->target.height);
	if (!onWayland()) {
		gtk_window_move(window, placement->target.x, placement->target.y);
	}
	watched.bounds = placement->target;
	watched.known = TRUE;
	watched.maximiseWhenSettled = placement->maximise;
	settleSoon();
	return G_SOURCE_REMOVE;
}

static gboolean collectSnapshot(gpointer data) {
	Snapshot *snapshot = data;
	GtkWindow *window = mainWindow();
	if (window == NULL) {
		return G_SOURCE_REMOVE;
	}
	snapshot->found = TRUE;
	snapshot->maximised = (stateOf(window) & GDK_WINDOW_STATE_MAXIMIZED) != 0;
	snapshot->plain = isPlain(window);
	snapshot->live = liveBounds(window);
	snapshot->trackedKnown = watched.known;
	snapshot->tracked = watched.bounds;
	GdkMonitor *monitor = gdk_display_get_monitor_at_window(gdk_display_get_default(), gtk_widget_get_window(GTK_WIDGET(window)));
	if (monitor != NULL) {
		GdkRectangle workarea;
		gdk_monitor_get_workarea(monitor, &workarea);
		snapshot->monitor = boxOf(workarea);
	}
	return G_SOURCE_REMOVE;
}

static void watchWindow(void) {
	callOnMainThread(watchMainWindow, NULL);
}

static void monitorAreas(Areas *areas) {
	callOnMainThread(collectAreas, areas);
}

static void placeWindowNatively(Placement *placement) {
	callOnMainThread(placeMainWindow, placement);
}

static void snapshotWindow(Snapshot *snapshot) {
	callOnMainThread(collectSnapshot, snapshot);
}
*/
import "C"

import "context"

const (
	placesBeforeShow = false
	startsMaximised  = false
)

func rectOfBox(box C.Box) windowRect {
	left, top := int(box.x), int(box.y)
	return windowRect{Left: left, Top: top, Right: left + int(box.width), Bottom: top + int(box.height)}
}

func boxOfRect(rect windowRect) C.Box {
	return C.Box{x: C.int(rect.Left), y: C.int(rect.Top), width: C.int(rect.width()), height: C.int(rect.height())}
}

func monitorWorkAreas() []windowRect {
	var areas C.Areas
	C.monitorAreas(&areas)
	rects := make([]windowRect, 0, int(areas.count))
	for index := 0; index < int(areas.count); index++ {
		if rect := rectOfBox(areas.boxes[index]); !rect.empty() {
			rects = append(rects, rect)
		}
	}
	return rects
}

func trackWindow(context.Context) {
	C.watchWindow()
}

func placeWindow(_ context.Context, state windowState) {
	areas := monitorWorkAreas()
	if len(areas) == 0 {
		return
	}
	fitted, _ := fitWindow(state.rect(), true, areas)
	placement := C.Placement{target: boxOfRect(fitted)}
	if state.Maximised {
		placement.maximise = 1
	}
	C.placeWindowNatively(&placement)
}

func currentWindow(_ context.Context, previous windowState, hasPrevious bool) (windowState, bool) {
	var snapshot C.Snapshot
	C.snapshotWindow(&snapshot)
	if snapshot.found == 0 {
		return windowState{}, false
	}
	if snapshot.plain != 0 {
		return plausibleState(rectOfBox(snapshot.live), false)
	}
	maximised := snapshot.maximised != 0
	rect, known := normalBoundsOf(snapshot, previous, hasPrevious)
	if !known {
		return windowState{}, false
	}
	if monitor := rectOfBox(snapshot.monitor); maximised && !monitor.empty() {
		rect = rect.insideOf(monitor)
	}
	return plausibleState(rect, maximised)
}

func normalBoundsOf(snapshot C.Snapshot, previous windowState, hasPrevious bool) (windowRect, bool) {
	if snapshot.trackedKnown != 0 {
		return rectOfBox(snapshot.tracked), true
	}
	return previous.rect(), hasPrevious
}

func plausibleState(rect windowRect, maximised bool) (windowState, bool) {
	if !plausibleWindow(rect) {
		return windowState{}, false
	}
	return windowStateOf(rect, maximised), true
}
