# CampusGuard

CampusGuard helps people find evacuation routes in Rizal Building and sends SOS requests to
the MCL Track Oval. The routing engine is C++; the desktop webview and phone app share the
polished interface in `web/`.

## Project map

```text
core/
  include/       C++ structures and algorithms used by the app
  src/           App and console entry points
web/             Shared desktop and phone interface
```

## C++ source files and lesson locations

The line numbers below refer to the current source files. The DSA lessons are used by
application features; there is no separate DSA lesson screen.

| C++ file | Lesson / purpose | Key source lines |
|---|---|---|
| `core/include/ds.hpp` | Singly linked list stores children in the campus hierarchy. | `LinkedList` at line 9 |
| `core/include/ds.hpp` | Doubly linked list stores people and their check-in state. | `DoublyLinkedList` at line 89 |
| `core/include/ds.hpp` | Stack supports last-in-first-out Undo and DFS reachability. | `Stack` at line 169 |
| `core/include/ds.hpp` | Queue supports FIFO SOS dispatch and BFS route exploration. | `Queue` at line 206 |
| `core/include/ds.hpp` | Circular list cycles through recent locations. | `CircularList` at line 251 |
| `core/include/ds.hpp` | Max heap is used for weighted route exploration and ranked destinations. | `MaxHeap` at line 329 |
| `core/include/Algorithms.hpp` | Merge sort prepares the base room-ID index. | `mergeSortRange` at line 7; `mergeSort` at line 39 |
| `core/include/Algorithms.hpp` | Binary search looks up IDs in the sorted base index. | `binarySearch` at line 46 |
| `core/include/Tree.hpp` | Binary tree base and binary search tree for exact location names. | `BinaryTree` at line 12; `BinarySearchTree` at line 34 |
| `core/include/Tree.hpp` | AVL index looks up dynamically added rooms. | `AvlIndex` at line 60 |
| `core/include/Tree.hpp` | Trie provides prefix-based location suggestions. | `Trie` at line 153 |
| `core/include/Tree.hpp` | Multi-child campus → building → floor hierarchy. | `TreeNode` at line 192 |
| `core/include/Graph.hpp` | Graph nodes and edges represent rooms, hallways, stairs, and exits. | `Graph` at line 37 |
| `core/include/Graph.hpp` | BFS finds a route with fewer connections. | `bfs` at line 114 |
| `core/include/Graph.hpp` | Dijkstra finds a route with the shortest estimated distance. | `dijkstra` at line 162 |
| `core/include/Graph.hpp` | DFS checks which indoor locations are cut off from all exits. | `cutOff` at line 213 |
| `core/include/Campus.hpp` | Connects the structures to application state and commands. | `Campus` at line 37; `exec` at line 247 |
| `core/include/Campus.hpp` | Builds the Rizal Building graph and campus hierarchy. | `buildRizal` at line 154; `buildTree` at line 237 |
| `core/include/Campus.hpp` | Builds and searches location indexes. | `rebuildIndex` at line 80; `idx` at line 101 |
| `core/include/Campus.hpp` | Chooses BFS or Dijkstra and returns route details. | `plan` at line 106; `planIf` at line 111 |
| `core/src/main.cpp` | Console entry point and scripted demo walkthrough. | `main` at line 16 |
| `core/src/gui.cpp` | Desktop WebView bridge sends commands to the C++ `Campus` engine. | `main` at line 17; `cg_exec` binding at line 28 |
| `core/src/app_mac.mm` | macOS Cocoa entry point and native interface. | `main` at line 374 |
| `core/src/wasm_api.cpp` | WebAssembly C interface to the C++ command engine. | `cg_exec` at line 10 |

`main.cpp`, `gui.cpp`, `app_mac.mm`, and `wasm_api.cpp` are entry-point or integration
files; the data-structure lessons themselves are implemented in the headers above. The
phone/offline app uses the JavaScript mirror in `web/engine.js`. The web UI is in
`web/index.html`, `web/app.js`, and `web/style.css`. Treat line numbers as starting points:
they can shift when source files change.

## Application regions and DSA lessons

| Application feature / region | Lessons applied |
|---|---|
| **Map and safe routes** | Graph models the building. BFS finds a route with fewer connections; Dijkstra finds the shortest estimated distance. Both avoid blocked or crowded nodes and edges. |
| **Rerouting after a hazard** | The same whole-building graph is searched again from the selected location after a hazard control updates the map. This works from modeled locations on every floor, not only CLIR. A blocked stair connection is avoided when another route to an open exit exists. |
| **Floor-by-floor route display** | UI draws the graph path on each floor and shows stair-transfer badges. Route calculation is handled by graph search, not by the drawing code. |
| **Alarm, extinguisher, hose, or refuge search** | Graph search finds a reachable node with the requested facility tag. |
| **Compare exits / assembly point** | Dijkstra calculates reachable destinations by estimated meters; a max heap ranks reachable exits and the assembly point. |
| **Find a location / suggestions** | Trie gives prefix suggestions; a binary search tree checks exact names; merge sort and binary search index base IDs; the AVL tree indexes dynamically added rooms. |
| **Recent locations** | Circular list stores a limited set of recent IDs and cycles through them. |
| **SOS support** | Queue handles SOS tickets first-in, first-out. The doubly linked list stores people and check-in state. |
| **Undo hazard** | Stack restores the most recent block/unblock change first. This is separate from the SOS queue. |
| **Blocked/cut-off report** | DFS with a stack explores outwards from available exits to find indoor locations no longer reachable. |
| **Campus hierarchy** | A multi-child tree organizes campus, building, floors, and locations. This is separate from the binary search tree used for name lookup. |
| **Fire simulation and crowd reports** | The simulation updates graph state; later route searches use that state. Simulation saves and restores affected state when toggled off. |
| **GPS, browser notifications, and pop-up alert** | Device/browser UI features, not DSA lessons. GPS requests one position fix and cannot identify an indoor room in this prototype. |
| **Emergency contacts and instructions** | Displayed contact and instruction data; no separate DSA lesson is needed for the UI. |

## Build and run

The project uses CMake to configure builds; generated Makefiles are build instructions, not
the app's source code. For a direct C++ build without CMake:

```sh
./build_native.sh              # build the console app
./build/campusguard            # run it; type "demo" for the walkthrough
```

On macOS, `./build_app_mac.sh` builds and opens the desktop app. On Windows, run
`build_windows.bat` in the Visual Studio C++ tools prompt. To preview the phone/web app, run
`./serve.sh` and open its printed address.

## Phone app (iPhone + Android)
1. Put the `web/` folder online with HTTPS (free): drag it onto https://app.netlify.com/drop  (or use GitHub Pages).
2. iPhone: open the link in **Safari** -> Share -> **Add to Home Screen**.
   Android: open the link in **Chrome** -> menu -> **Install app**.
3. Open it once with internet; after that it works fully offline (the engine runs on the phone).
Quick Wi-Fi test without hosting: `./serve.sh` (Mac) or `serve.bat` (Windows), open the printed address on the phone.
(Home-screen install + offline needs HTTPS; plain http only works as a normal page.)

## Map notes

The room numbers on floors 2–5 come from the provided evacuation plans. The ground-floor
plan has no room labels, so its room names are placeholders (`R1S1`–`R1N5`). The layout and
distances are approximate teaching schematics, not surveyed emergency directions. Follow
posted signs and campus staff. Tune distances in `core/include/Campus.hpp` and `web/engine.js`.

The phone app uses `web/engine.js`, a JavaScript mirror of the C++ engine. The Mac and Windows
desktop apps use the C++ engine.

The `FnCS` nodes represent the core stairway on each floor and connect vertically between floors.
These paths are part of the approximate demo map and should be checked against posted evacuation
plans before real-world use.

## Emergency demo and location limits

The **Simulate fire** control raises a local demo alert, marks the chosen demo room as the
simulated fire, and marks the west/east stairs on that floor as crowded. The user's selected
location remains separate, so the **Nearest available exit** action routes from that location.
Routes avoid blocked and crowded locations. **Report crowding here** is a manual demo signal;
it is not shared with other devices.
The selected route remains highlighted as you switch floors; green stair badges show the next
floor to follow when the route changes levels. After a hazard change, the app recalculates
the route from the selected location using the chosen preference (fewest connections or
shortest estimated distance) across the whole building graph, and announces if the
recommended exit changes. The same search can start from any modeled floor
and use any connected, unblocked route. If every path is blocked, the app reports that it
cannot find a safe route instead of inventing one. Starting the fire demo opens an in-app
pop-up with a shortcut to route from the selected location.
Browser notifications require permission and a supported secure browser context. There is no
push-notification server, so the project cannot broadcast real incidents to users whose app is
closed.

The optional GPS check requests one position fix and displays its accuracy without storing or
sharing coordinates. The schematic map has no real-world coordinate calibration, and phone GPS
cannot reliably identify an indoor floor or room. Users still need to choose their location on
the map. Room-level RFID positioning would require compatible readers, phone support, and a
separate integration.

## Why CampusGuard? Pros, cons, and a panel-ready explanation

CampusGuard is an educational evacuation-route prototype for the Rizal Building. It
demonstrates how a building map, selected user location, hazard state, and graph algorithms
can identify an available route to an exit or the MCL Track Oval. It also demonstrates SOS
dispatch and check-in while applying DSA lessons in actual features.

**Potential advantages**

- Visualizes a route and can find an alternative when a modeled hallway, stair, or exit is
  marked blocked or crowded.
- Lets users compare modeled exits and follow a route across floors.
- Makes DSA lessons easier to demonstrate through working application features.
- Provides a foundation for future integration with verified maps, indoor positioning, and
  authorized incident information.

**Current limitations and risks**

- Asking a person to open the app and manually select a room during an emergency can cost
  time. The prototype does not automatically know their room or floor.
- GPS usually cannot provide reliable room-level indoor positioning. The GPS button only
  requests a one-time position fix and reports its accuracy.
- The map and distances are teaching estimates, not surveyed or safety-certified directions.
- Blockages and crowding are local demo inputs. There is no live sensor, shared crowd feed,
  campus emergency connection, or push-notification service.
- The route can only avoid hazards represented accurately in its graph. Users must follow
  official alarms, posted evacuation signs, emergency personnel, and campus instructions.

**Long-term proposal:** If the campus chooses to develop this beyond a prototype, room-level
RFID or another tested indoor-positioning system could provide a user's approximate location.
An authorized campus incident system could publish verified blocked exits and crowd conditions.
With reliable location, hazard data, connectivity, privacy controls, and emergency validation,
the app could alert the user and calculate a route without asking them to find their room first.
These are future requirements, not features currently delivered by this demo.

**Panel-ready answer:** “CampusGuard demonstrates how a building map and route algorithms can
show an available evacuation path and recalculate when a modeled path is blocked. We recognize
that asking someone to select a room during a crisis is a limitation, and the current prototype
does not have live hazard or indoor-location data. In a long-term campus deployment, tested
indoor positioning and an authorized emergency feed could automate location and alerts. Until
those systems are validated, this app is only a supplementary guide—official alarms, signs,
and staff instructions take priority.”
