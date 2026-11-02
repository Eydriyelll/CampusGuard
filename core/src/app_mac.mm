// CampusGuard - NATIVE macOS desktop application (Cocoa/AppKit). No web view, no extra libraries.
// Uses the same C++ engine (Campus.hpp) directly. Build with build_app_mac.sh.
#import <Cocoa/Cocoa.h>
#include "../include/Campus.hpp"

static Campus* gCampus = nullptr;

// Run one engine command and parse its JSON answer (NSDictionary or NSArray).
static id cg(NSString* cmd) {
    std::string r = gCampus->exec([cmd UTF8String]);
    NSData* d = [NSData dataWithBytes:r.data() length:r.size()];
    id o = [NSJSONSerialization JSONObjectWithData:d options:0 error:nil];
    return o ? o : @{@"ok": @NO, @"msg": @"Engine returned bad data"};
}
static BOOL okOf(id o) {
    if (![o isKindOfClass:[NSDictionary class]]) return YES;
    id v = o[@"ok"]; return v == nil || [v boolValue];
}
static void dumpTree(NSDictionary* n, int depth, NSMutableString* s) {
    [s appendFormat:@"%*s%@\n", depth * 2, "", n[@"n"]];
    for (NSDictionary* c in n[@"c"]) dumpTree(c, depth + 1, s);
}

// ============================================================ map view (custom drawing)
@interface MapView : NSView
@property (nonatomic, strong) NSArray* nodes;
@property (nonatomic, strong) NSArray* edges;
@property (nonatomic, strong) NSDictionary* idIdx;
@property (nonatomic, strong) NSSet* blocked;
@property (nonatomic, strong) NSSet* cutoff;
@property (nonatomic, strong) NSArray* route;
@property (nonatomic) int floorNo;
@property (nonatomic) int layers;   // which legend icons to draw (bit flags: 1 alarm, 2 extinguisher, 4 hose, 8 refuge)
@property (nonatomic) NSInteger sel;
@property (nonatomic, copy) void (^onPick)(NSInteger);
@end

@implementation MapView {
    double _sc, _ox, _oy;
}
- (BOOL)isFlipped { return YES; }
- (BOOL)acceptsFirstMouse:(NSEvent*)e { return YES; }
- (BOOL)isNode:(id)n { return [n isKindOfClass:[NSDictionary class]]; }
- (BOOL)visible:(NSDictionary*)n {
    int f = [n[@"f"] intValue], k = [n[@"k"] intValue];
    return _floorNo == 0 ? (f == 0 || k == 2) : f == _floorNo;
}
- (NSPoint)pt:(NSDictionary*)n { return NSMakePoint(_ox + [n[@"x"] doubleValue] * _sc, _oy + [n[@"y"] doubleValue] * _sc); }

- (void)drawRect:(NSRect)dirty {
    [[NSColor whiteColor] setFill]; NSRectFill(self.bounds);
    if (!_nodes) return;
    double w = self.bounds.size.width, h = self.bounds.size.height;
    _sc = MIN(w, h) / 116.0; _ox = (w - 116 * _sc) / 2 + 8 * _sc; _oy = (h - 116 * _sc) / 2 + 8 * _sc;

    NSDictionary* small = @{NSFontAttributeName: [NSFont systemFontOfSize:9], NSForegroundColorAttributeName: [NSColor grayColor]};
    NSDictionary* lab = @{NSFontAttributeName: [NSFont systemFontOfSize:10 weight:NSFontWeightMedium],
                          NSForegroundColorAttributeName: [NSColor colorWithCalibratedWhite:0.1 alpha:1]};
    NSDictionary* head = @{NSFontAttributeName: [NSFont boldSystemFontOfSize:15], NSForegroundColorAttributeName: [NSColor colorWithCalibratedWhite:0.45 alpha:1]};
    NSString* title = _floorNo == 0 ? @"Outside - road to the MCL Track Oval" : [NSString stringWithFormat:@"Rizal Building - Floor %d", _floorNo];
    [title drawAtPoint:NSMakePoint(12, 10) withAttributes:head];

    // hallways
    for (NSArray* e in _edges) {
        id A = _nodes[[e[0] intValue]], B = _nodes[[e[1] intValue]];
        if (![self isNode:A] || ![self isNode:B] || ![self visible:A] || ![self visible:B]) continue;
        NSPoint p = [self pt:A], q = [self pt:B]; BOOL bl = [e[3] intValue] != 0;
        NSBezierPath* path = [NSBezierPath bezierPath]; [path moveToPoint:p]; [path lineToPoint:q];
        path.lineWidth = bl ? 3 : 2;
        if (bl) { CGFloat dash[2] = {6, 4}; [path setLineDash:dash count:2 phase:0]; [[NSColor systemRedColor] setStroke]; }
        else [[NSColor colorWithCalibratedWhite:0.72 alpha:1] setStroke];
        [path stroke];
        NSString* t = [NSString stringWithFormat:@"%dm", [e[2] intValue]];
        [t drawAtPoint:NSMakePoint((p.x + q.x) / 2 + 3, (p.y + q.y) / 2 - 12) withAttributes:small];
    }
    // route (orange)
    NSMutableSet* onRoute = [NSMutableSet set];
    for (NSUInteger k = 0; k < _route.count; k++) {
        [onRoute addObject:_route[k]];
        if (k + 1 >= _route.count) continue;
        NSNumber *ia = _idIdx[_route[k]], *ib = _idIdx[_route[k + 1]];
        if (!ia || !ib) continue;
        id A = _nodes[ia.integerValue], B = _nodes[ib.integerValue];
        if (![self isNode:A] || ![self isNode:B] || ![self visible:A] || ![self visible:B]) continue;
        NSBezierPath* path = [NSBezierPath bezierPath]; [path moveToPoint:[self pt:A]]; [path lineToPoint:[self pt:B]];
        path.lineWidth = 5; path.lineCapStyle = NSLineCapStyleRound; [[NSColor colorWithCalibratedRed:0.12 green:0.62 blue:0.33 alpha:1] setStroke]; [path stroke];
        // Escape Direction arrow at the middle of the segment
        NSPoint pa = [self pt:A], pb = [self pt:B]; double dx = pb.x - pa.x, dy = pb.y - pa.y, L = hypot(dx, dy); if (L < 1) continue;
        double ux = dx / L, uy = dy / L, mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        NSBezierPath* ar = [NSBezierPath bezierPath];
        [ar moveToPoint:NSMakePoint(mx + ux * 8, my + uy * 8)];
        [ar lineToPoint:NSMakePoint(mx - ux * 5 - uy * 6, my - uy * 5 + ux * 6)];
        [ar lineToPoint:NSMakePoint(mx - ux * 5 + uy * 6, my - uy * 5 - ux * 6)]; [ar closePath];
        [[NSColor whiteColor] setFill]; [ar fill];
    }
    // places
    NSArray* fills = @[[NSColor colorWithCalibratedRed:0.31 green:0.55 blue:0.94 alpha:1], [NSColor colorWithCalibratedWhite:0.55 alpha:1],
                       [NSColor colorWithCalibratedRed:0.10 green:0.60 blue:0.32 alpha:1], [NSColor colorWithCalibratedRed:0.88 green:0.66 blue:0.0 alpha:1]];
    for (NSUInteger i = 0; i < _nodes.count; i++) {
        NSDictionary* n = _nodes[i]; if (![self isNode:n] || ![self visible:n]) continue;
        NSPoint p = [self pt:n]; double r = 8; NSString* nid = n[@"id"];
        NSBezierPath* c = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(p.x - r, p.y - r, 2 * r, 2 * r)];
        [([_blocked containsObject:nid] ? [NSColor systemRedColor] : fills[[n[@"k"] intValue] % 4]) setFill]; [c fill];
        if ((NSInteger)i == _sel) { [[NSColor blackColor] setStroke]; c.lineWidth = 3; }
        else if ([onRoute containsObject:nid]) { [[NSColor colorWithCalibratedRed:0.06 green:0.42 blue:0.22 alpha:1] setStroke]; c.lineWidth = 3; }
        else if ([_cutoff containsObject:nid]) { [[NSColor systemOrangeColor] setStroke]; c.lineWidth = 2.5; }
        else { [[NSColor whiteColor] setStroke]; c.lineWidth = 1.5; }
        [c stroke];
        int tg = [n[@"t"] intValue];
        if (tg & 16) {                                   // Fire Exit: green ring
            NSBezierPath* fx = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(p.x - r - 4, p.y - r - 4, 2 * r + 8, 2 * r + 8)];
            fx.lineWidth = 2; [[NSColor colorWithCalibratedRed:0.10 green:0.60 blue:0.32 alpha:1] setStroke]; [fx stroke];
        }
        int badge[4] = {1, 2, 4, 8}; NSArray* bc = @[[NSColor colorWithCalibratedRed:0.83 green:0.18 blue:0.18 alpha:1], [NSColor colorWithCalibratedRed:0.70 green:0.15 blue:0.12 alpha:1],
                                                      [NSColor colorWithCalibratedRed:0.54 green:0.29 blue:0.16 alpha:1], [NSColor colorWithCalibratedRed:0.12 green:0.44 blue:0.92 alpha:1]];
        NSArray* bt = @[@"!", @"E", @"H", @"\u267F"]; int shown[4], ns = 0;
        for (int b = 0; b < 4; b++) if ((tg & badge[b]) && (_layers & badge[b])) shown[ns++] = b;
        NSDictionary* bta = @{NSFontAttributeName: [NSFont boldSystemFontOfSize:9], NSForegroundColorAttributeName: [NSColor whiteColor]};
        for (int k = 0; k < ns; k++) {
            double bx = p.x + (k - (ns - 1) / 2.0) * 15, by = p.y - r - 12; NSRect br = NSMakeRect(bx - 6, by - 6, 12, 12);
            [bc[shown[k]] setFill]; [[NSBezierPath bezierPathWithRoundedRect:br xRadius:(shown[k] == 1 ? 6 : 2.5) yRadius:(shown[k] == 1 ? 6 : 2.5)] fill];
            NSString* g = bt[shown[k]]; NSSize gs = [g sizeWithAttributes:bta]; [g drawAtPoint:NSMakePoint(bx - gs.width / 2, by - gs.height / 2) withAttributes:bta];
        }
        NSSize sz = [nid sizeWithAttributes:lab];
        [nid drawAtPoint:NSMakePoint(p.x - sz.width / 2, p.y + r + 2) withAttributes:lab];
    }
}
- (void)mouseDown:(NSEvent*)e {
    NSPoint p = [self convertPoint:e.locationInWindow fromView:nil];
    NSInteger best = -1; double bd = 1e9;
    for (NSUInteger i = 0; i < _nodes.count; i++) {
        NSDictionary* n = _nodes[i]; if (![self isNode:n] || ![self visible:n]) continue;
        NSPoint q = [self pt:n]; double d = hypot(q.x - p.x, q.y - p.y);
        if (d < bd) { bd = d; best = (NSInteger)i; }
    }
    if (best >= 0 && bd <= 16 && _onPick) _onPick(best);
}
@end

@interface FlipView : NSView @end
@implementation FlipView - (BOOL)isFlipped { return YES; } @end

static NSButton* mkBtn(id target, NSString* t, SEL a, NSRect f, NSView* parent) {
    NSButton* b = [NSButton buttonWithTitle:t target:target action:a]; b.frame = f; [parent addSubview:b]; return b;
}

// ============================================================ application controller
@interface AppDelegate : NSObject <NSApplicationDelegate> @end

@implementation AppDelegate {
    NSWindow* _win; MapView* _map; NSSegmentedControl* _seg; NSTextField *_selLabel, *_msg, *_uid, *_uname;
    NSPopUpButton* _kind; NSTextView* _log;
    NSArray* _nodes; NSDictionary* _status; NSMutableDictionary* _idIdx;
    NSInteger _sel, _pendingEdge; NSString* _lastKind;
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication*)a { return YES; }

- (void)applicationDidFinishLaunching:(NSNotification*)n {
    _sel = -1; _pendingEdge = -1; _idIdx = [NSMutableDictionary dictionary];
    const CGFloat W = 1060, H = 790, SB = 360;
    _win = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, W, H)
                                       styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
                                         backing:NSBackingStoreBuffered defer:NO];
    _win.title = @"CampusGuard - Smart Campus Evacuation"; _win.minSize = NSMakeSize(900, 700);
    NSView* root = _win.contentView;

    _seg = [NSSegmentedControl segmentedControlWithLabels:@[@"1F", @"2F", @"3F", @"4F", @"5F", @"Outside"]
                                             trackingMode:NSSegmentSwitchTrackingSelectOne target:self action:@selector(floorChanged:)];
    _seg.frame = NSMakeRect(12, H - 36, W - SB - 24, 26); _seg.autoresizingMask = NSViewWidthSizable | NSViewMinYMargin;
    _seg.selectedSegment = 0; [root addSubview:_seg];

    _map = [[MapView alloc] initWithFrame:NSMakeRect(0, 0, W - SB, H - 44)];
    _map.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable; _map.floorNo = 1; _map.sel = -1; _map.layers = 1 | 4 | 8;
    __weak AppDelegate* ws = self; _map.onPick = ^(NSInteger i) { [ws picked:i]; };
    [root addSubview:_map];

    FlipView* sb = [[FlipView alloc] initWithFrame:NSMakeRect(W - SB, 0, SB, H)];
    sb.autoresizingMask = NSViewMinXMargin | NSViewHeightSizable; [root addSubview:sb];
    CGFloat X = 12, IW = SB - 24, HW = (IW - 8) / 2;

    NSTextField* t = [NSTextField labelWithString:@"CampusGuard"]; t.font = [NSFont boldSystemFontOfSize:20]; t.frame = NSMakeRect(X, 10, IW, 26); [sb addSubview:t];
    NSTextField* sub = [NSTextField labelWithString:@"Rizal Building evacuation to the MCL Track Oval"]; sub.font = [NSFont systemFontOfSize:11];
    sub.textColor = [NSColor secondaryLabelColor]; sub.frame = NSMakeRect(X, 36, IW, 16); [sb addSubview:sub];
    _selLabel = [NSTextField wrappingLabelWithString:@"Click a place on the map to choose where you are."]; _selLabel.frame = NSMakeRect(X, 60, IW, 34); [sb addSubview:_selLabel];

    mkBtn(self, @"Nearest exit", @selector(doExit:), NSMakeRect(X, 100, HW, 28), sb);
    mkBtn(self, @"Route to Oval", @selector(doOval:), NSMakeRect(X + HW + 8, 100, HW, 28), sb);
    mkBtn(self, @"Nearest fire alarm", @selector(doAlarm:), NSMakeRect(X, 134, HW, 28), sb);
    mkBtn(self, @"Nearest extinguisher", @selector(doExt:), NSMakeRect(X + HW + 8, 134, HW, 28), sb);
    mkBtn(self, @"Nearest fire hose", @selector(doHose:), NSMakeRect(X, 168, HW, 28), sb);
    mkBtn(self, @"Safe refuge", @selector(doRefuge:), NSMakeRect(X + HW + 8, 168, HW, 28), sb);
    mkBtn(self, @"Block / unblock place", @selector(doHazard:), NSMakeRect(X, 202, HW, 28), sb);
    mkBtn(self, @"Block hallway...", @selector(doEdge:), NSMakeRect(X + HW + 8, 202, HW, 28), sb);
    mkBtn(self, @"Undo hazard", @selector(doUndo:), NSMakeRect(X, 236, HW, 28), sb);
    mkBtn(self, @"Oval distances", @selector(doOvalTable:), NSMakeRect(X + HW + 8, 236, HW, 28), sb);
    NSArray* lt = @[@"Alarms", @"Extinguishers", @"Hoses", @"Refuge"]; int lb[4] = {1, 2, 4, 8}; CGFloat lw[4] = {72, 108, 70, 76}, lx = X;
    for (int i = 0; i < 4; i++) {
        NSButton* cb = [NSButton checkboxWithTitle:lt[i] target:self action:@selector(layerToggled:)]; cb.tag = lb[i];
        cb.state = (lb[i] & _map.layers) ? NSControlStateValueOn : NSControlStateValueOff; cb.frame = NSMakeRect(lx, 270, lw[i], 20); lx += lw[i]; [sb addSubview:cb];
    }

    NSTextField* h2 = [NSTextField labelWithString:@"SOS & check-in"]; h2.font = [NSFont boldSystemFontOfSize:12]; h2.frame = NSMakeRect(X, 300, IW, 16); [sb addSubview:h2];
    _uid = [NSTextField textFieldWithString:@"U1"]; _uid.placeholderString = @"User ID"; _uid.frame = NSMakeRect(X, 320, 70, 24); [sb addSubview:_uid];
    _uname = [NSTextField textFieldWithString:@"Student"]; _uname.placeholderString = @"Name"; _uname.frame = NSMakeRect(X + 78, 320, 130, 24); [sb addSubview:_uname];
    _kind = [[NSPopUpButton alloc] initWithFrame:NSMakeRect(X + 216, 318, IW - 216, 26) pullsDown:NO];
    [_kind addItemsWithTitles:@[@"injury", @"trapped", @"fire", @"medical", @"distress"]]; [sb addSubview:_kind];
    mkBtn(self, @"Send SOS", @selector(doSos:), NSMakeRect(X, 352, HW, 28), sb);
    mkBtn(self, @"Dispatch next", @selector(doNext:), NSMakeRect(X + HW + 8, 352, HW, 28), sb);
    mkBtn(self, @"I am here (at Oval)", @selector(doCheckin:), NSMakeRect(X, 386, HW, 28), sb);
    mkBtn(self, @"Incident report", @selector(doReport:), NSMakeRect(X + HW + 8, 386, HW, 28), sb);
    mkBtn(self, @"Status", @selector(doStatus:), NSMakeRect(X, 420, HW, 28), sb);
    mkBtn(self, @"Campus tree", @selector(doTree:), NSMakeRect(X + HW + 8, 420, HW, 28), sb);
    mkBtn(self, @"Emergency contacts", @selector(doContacts:), NSMakeRect(X, 454, HW, 28), sb);
    mkBtn(self, @"Legend", @selector(doLegend:), NSMakeRect(X + HW + 8, 454, HW, 28), sb);

    _msg = [NSTextField wrappingLabelWithString:@""]; _msg.textColor = [NSColor systemOrangeColor]; _msg.frame = NSMakeRect(X, 488, IW, 34); [sb addSubview:_msg];

    CGFloat ly = 526, lh = H - ly - 12;
    NSScrollView* sv = [[NSScrollView alloc] initWithFrame:NSMakeRect(X, ly, IW, lh)];
    sv.hasVerticalScroller = YES; sv.borderType = NSBezelBorder; sv.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    _log = [[NSTextView alloc] initWithFrame:NSMakeRect(0, 0, IW, lh)];
    _log.editable = NO; _log.font = [NSFont userFixedPitchFontOfSize:11];
    _log.minSize = NSMakeSize(0, lh); _log.maxSize = NSMakeSize(FLT_MAX, FLT_MAX);
    _log.verticallyResizable = YES; _log.horizontallyResizable = NO; _log.autoresizingMask = NSViewWidthSizable;
    _log.textContainer.containerSize = NSMakeSize(IW, FLT_MAX); _log.textContainer.widthTracksTextView = YES;
    sv.documentView = _log; [sb addSubview:sv];

    [self reload]; [self doOvalTable:nil];
    [_win center]; [_win makeKeyAndOrderFront:nil]; [NSApp activateIgnoringOtherApps:YES];
}

// ---------------------------------------------------------------- helpers
- (void)msg:(NSString*)s { _msg.stringValue = s ? s : @""; }
- (void)log:(NSString*)s { _log.string = s; [_log scrollRangeToVisible:NSMakeRange(0, 0)]; }
- (NSString*)selId { return _sel >= 0 ? _nodes[_sel][@"id"] : nil; }
- (NSString*)cleanName { NSString* s = [_uname.stringValue stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
    return [(s.length ? s : @"Student") stringByReplacingOccurrencesOfString:@" " withString:@"_"]; }
- (NSString*)cleanUid { NSString* s = [_uid.stringValue stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]; return s.length ? s : @"U1"; }

- (void)setFloor:(int)f {
    _map.floorNo = f; _seg.selectedSegment = (f == 0) ? 5 : f - 1; [_map setNeedsDisplay:YES];
}
- (void)floorChanged:(NSSegmentedControl*)s { NSInteger i = s.selectedSegment; _map.floorNo = (i == 5) ? 0 : (int)i + 1; [_map setNeedsDisplay:YES]; }

- (void)reload {
    NSDictionary* m = cg(@"map"); _nodes = m[@"nodes"]; [_idIdx removeAllObjects];
    for (NSUInteger i = 0; i < _nodes.count; i++) if ([_nodes[i] isKindOfClass:[NSDictionary class]]) _idIdx[_nodes[i][@"id"]] = @(i);
    _status = cg(@"status");
    _map.nodes = _nodes; _map.edges = m[@"edges"]; _map.idIdx = _idIdx;
    _map.blocked = [NSSet setWithArray:_status[@"blocked"] ?: @[]]; _map.cutoff = [NSSet setWithArray:_status[@"cutoff"] ?: @[]];
    if (_sel >= 0 && (_sel >= (NSInteger)_nodes.count || ![_nodes[_sel] isKindOfClass:[NSDictionary class]])) _sel = -1;
    [self refreshSel];
}
- (void)refreshSel {
    _map.sel = _sel;
    if (_sel >= 0) { NSDictionary* n = _nodes[_sel]; int f = [n[@"f"] intValue];
        _selLabel.stringValue = [NSString stringWithFormat:@"Selected: %@ (%@, %@)", n[@"name"], n[@"id"], f == 0 ? @"outdoors" : [NSString stringWithFormat:@"floor %d", f]];
    } else _selLabel.stringValue = @"Click a place on the map to choose where you are.";
    [_map setNeedsDisplay:YES];
}
- (void)picked:(NSInteger)i {
    if (_pendingEdge >= 0) {
        NSString *a = _nodes[_pendingEdge][@"id"], *b = _nodes[i][@"id"]; _pendingEdge = -1;
        NSDictionary* r = cg([NSString stringWithFormat:@"hazard %@ %@", a, b]);
        [self msg:okOf(r) ? [NSString stringWithFormat:@"Hallway %@-%@ toggled.", a, b] : r[@"msg"]];
        [self afterHazard]; return;
    }
    _sel = i; [self refreshSel];
}
- (void)afterHazard { [self reload]; if (_sel >= 0 && _lastKind) [self routeKind:_lastKind]; else [self doStatus:nil]; }

- (void)routeKind:(NSString*)k {
    if (_sel < 0) { [self msg:@"Pick your location on the map first."]; return; }
    _lastKind = k; [self showRoute:cg([NSString stringWithFormat:@"find %@ %@", [self selId], k])];
}
- (void)showRoute:(NSDictionary*)r {
    if (!okOf(r)) { _map.route = nil; [self msg:r[@"msg"]]; [self log:[NSString stringWithFormat:@"NO ROUTE\n%@", r[@"msg"]]]; [_map setNeedsDisplay:YES]; return; }
    NSArray *path = r[@"path"], *names = r[@"names"];
    NSDictionary* titles = @{@"exit": @"NEAREST FIRE EXIT", @"center": @"ROUTE TO THE OVAL (ASSEMBLY POINT)", @"alarm": @"NEAREST FIRE ALARM CALL POINT",
                             @"extinguisher": @"NEAREST FIRE EXTINGUISHER", @"hose": @"NEAREST FIRE HOSE", @"refuge": @"NEAREST SAFE REFUGE"};
    NSMutableString* s = [NSMutableString stringWithFormat:@"%@\n%d m, %d steps\n", titles[_lastKind ?: @"exit"] ?: @"ROUTE", [r[@"meters"] intValue], [r[@"steps"] intValue]];
    if ([_lastKind isEqualToString:@"exit"] || [_lastKind isEqualToString:@"center"]) {
        [s appendFormat:@"To exit: %d m (%@)\n", [r[@"toExit"] intValue], r[@"exit"]];
        if ([r[@"toOval"] intValue] > 0) [s appendFormat:@"Exit -> Oval: %d m\n", [r[@"toOval"] intValue]];
    }
    [s appendString:@"\n"];
    for (NSUInteger i = 0; i < path.count; i++) {
        NSNumber* ix = _idIdx[path[i]]; int f = ix ? [_nodes[ix.integerValue][@"f"] intValue] : 0;
        [s appendFormat:@"%2lu. %@  [%@]\n", (unsigned long)(i + 1), names[i], f == 0 ? @"outside" : [NSString stringWithFormat:@"F%d", f]];
    }
    _map.route = path;
    NSNumber* first = _idIdx[path[0]]; if (first) { int f = [_nodes[first.integerValue][@"f"] intValue]; if (f > 0) [self setFloor:f]; }
    [self log:s]; [self msg:@"Route shown on the map in green (arrows = escape direction)."]; [_map setNeedsDisplay:YES];
}

// ---------------------------------------------------------------- button actions
- (void)doExit:(id)s { [self routeKind:@"exit"]; }
- (void)doOval:(id)s { [self routeKind:@"center"]; }
- (void)doAlarm:(id)s { [self routeKind:@"alarm"]; }
- (void)doExt:(id)s { [self routeKind:@"extinguisher"]; }
- (void)doHose:(id)s { [self routeKind:@"hose"]; }
- (void)doRefuge:(id)s { [self routeKind:@"refuge"]; }
- (void)layerToggled:(NSButton*)b { if (b.state == NSControlStateValueOn) _map.layers |= (int)b.tag; else _map.layers &= ~(int)b.tag; [_map setNeedsDisplay:YES]; }
- (void)doContacts:(id)s {
    NSDictionary* r = cg(@"contacts"); NSMutableString* t = [NSMutableString stringWithString:@"EMERGENCY CONTACTS\n\n"];
    for (NSDictionary* c in r[@"contacts"]) [t appendFormat:@"%@\n   %@\n", c[@"name"], c[@"number"]];
    [t appendString:@"\nTELL THE RESPONDER\n"]; for (NSString* q in r[@"relay"]) [t appendFormat:@" - %@\n", q];
    [t appendString:@"\nIN THE EVENT OF A FIRE\n"]; for (NSString* q in r[@"fire"]) [t appendFormat:@" - %@\n", q];
    [self log:t];
}
- (void)doLegend:(id)s {
    [self log:@"LEGEND (same as the posted plans)\n\n[!] red round   Fire Alarm Call Point\n[E] red dot     Fire Extinguisher\n[H] brown       Fire Hose\n[wheelchair] blue  Safe Refuge\n"
              "Gold circle    Assembly Point (MCL Track Oval)\nGreen ring     Fire Exit (exit door / fire-exit stairs)\nGreen line     Escape Route\nWhite arrows   Escape Direction\n"
              "Red dashed     Blocked hallway\nOrange ring    Cut off from every exit\n\nDo NOT use the elevator."];
}
- (void)doHazard:(id)s {
    if (_sel < 0) { [self msg:@"Pick a place on the map first."]; return; }
    NSString* nid = [self selId]; NSDictionary* r = cg([NSString stringWithFormat:@"hazard %@", nid]);
    if (!okOf(r)) { [self msg:r[@"msg"]]; return; }
    [self msg:[r[@"blocked"] containsObject:nid] ? [NSString stringWithFormat:@"%@ is now BLOCKED.", nid] : [NSString stringWithFormat:@"%@ reopened.", nid]];
    [self afterHazard];
}
- (void)doEdge:(id)s {
    if (_sel < 0) { [self msg:@"Pick a place on the map first."]; return; }
    _pendingEdge = _sel; [self msg:@"Now click the connected place to block/unblock the hallway between them."];
}
- (void)doUndo:(id)s { NSDictionary* r = cg(@"undo"); [self msg:okOf(r) ? @"Last hazard undone." : r[@"msg"]]; if (okOf(r)) [self afterHazard]; }
- (void)doOvalTable:(id)s {
    NSArray* rows = cg(@"oval");
    NSMutableString* t = [NSMutableString stringWithString:@"APPROX. DISTANCE TO THE OVAL\n(from each floor's central junction)\n\nFloor  Via   To exit  Exit>Oval  Total\n"];
    for (NSDictionary* r in rows) {
        if ([r[@"meters"] intValue] < 0) { [t appendFormat:@"%dF     CUT OFF\n", [r[@"floor"] intValue]]; continue; }
        [t appendFormat:@"%dF     %-5s %4d m   %5d m   ~%d m\n", [r[@"floor"] intValue], [r[@"exit"] UTF8String], [r[@"toExit"] intValue], [r[@"toOval"] intValue], [r[@"approx"] intValue]];
    }
    [self log:t];
}
- (void)doSos:(id)s {
    if (_sel < 0) { [self msg:@"Pick your location on the map first."]; return; }
    NSDictionary* r = cg([NSString stringWithFormat:@"sos %@ %@ %@ %@", [self cleanUid], [self cleanName], [self selId], _kind.titleOfSelectedItem]);
    if (!okOf(r)) { [self msg:r[@"msg"]]; return; }
    _lastKind = @"center"; [self showRoute:r[@"route"]];
    [self msg:[NSString stringWithFormat:@"SOS #%d sent (queue: %d). Follow the green route to the Oval, then press \"I am here\".", [r[@"ticket"] intValue], [r[@"queue"] intValue]]];
}
- (void)doNext:(id)s {
    NSDictionary* r = cg(@"next"); if (!okOf(r)) { [self msg:r[@"msg"]]; return; }
    [self log:[NSString stringWithFormat:@"DISPATCHING TICKET #%d\nUser: %@\nLocation: %@\nProblem: %@\n", [r[@"ticket"] intValue], r[@"user"], r[@"at"], r[@"kind"]]];
    [self msg:@"Next SOS dispatched."];
}
- (void)doCheckin:(id)s {
    NSString* u = [self cleanUid]; NSDictionary* r = cg([NSString stringWithFormat:@"checkin %@", u]);
    if (!okOf(r)) { cg([NSString stringWithFormat:@"register %@ %@ OVAL", u, [self cleanName]]); r = cg([NSString stringWithFormat:@"checkin %@", u]); }
    [self msg:okOf(r) ? @"Checked in - you are accounted for." : r[@"msg"]];
}
- (void)doReport:(id)s {
    NSDictionary* r = cg(@"report");
    [self log:[NSString stringWithFormat:@"INCIDENT REPORT\n\nSOS total:     %d\nHandled:       %d\nPending:       %d\nPeople:        %d\nChecked in:    %d\nUnaccounted:   %d\nHazard events: %d\n",
        [r[@"sosTotal"] intValue], [r[@"handled"] intValue], [r[@"pending"] intValue], [r[@"people"] intValue], [r[@"checkedIn"] intValue], [r[@"unaccounted"] intValue], [r[@"hazardEvents"] intValue]]];
}
- (void)doStatus:(id)s {
    _status = cg(@"status"); NSMutableString* t = [NSMutableString stringWithString:@"STATUS\n\n"];
    NSArray *bl = _status[@"blocked"], *be = _status[@"blockedEdges"], *cu = _status[@"cutoff"], *un = _status[@"unaccounted"];
    [t appendFormat:@"SOS queue: %d\n", [_status[@"queue"] intValue]];
    [t appendFormat:@"Blocked places: %@\n", bl.count ? [bl componentsJoinedByString:@", "] : @"none"];
    NSMutableArray* es = [NSMutableArray array]; for (NSArray* e in be) [es addObject:[NSString stringWithFormat:@"%@-%@", e[0], e[1]]];
    [t appendFormat:@"Blocked hallways: %@\n", es.count ? [es componentsJoinedByString:@", "] : @"none"];
    [t appendFormat:@"Cut off from every exit: %@\n", cu.count ? [cu componentsJoinedByString:@", "] : @"none"];
    [t appendFormat:@"Not yet checked in: %@\n", un.count ? [un componentsJoinedByString:@", "] : @"none"];
    [self log:t];
}
- (void)doTree:(id)s { NSMutableString* t = [NSMutableString stringWithString:@"CAMPUS TREE\n\n"]; dumpTree(cg(@"tree"), 0, t); [self log:t]; }
@end

int main(int argc, const char* argv[]) {
    @autoreleasepool {
        gCampus = new Campus();
        NSApplication* app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        AppDelegate* d = [AppDelegate new]; app.delegate = d;
        NSMenu* bar = [NSMenu new]; NSMenuItem* mi = [NSMenuItem new]; [bar addItem:mi];
        NSMenu* m = [NSMenu new]; [m addItemWithTitle:@"Quit CampusGuard" action:@selector(terminate:) keyEquivalent:@"q"]; mi.submenu = m;
        app.mainMenu = bar;
        [app run];
    }
    return 0;
}
