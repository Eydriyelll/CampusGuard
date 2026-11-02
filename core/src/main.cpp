// Desktop/console build - this is what you demo and test in class.
#include <iostream>
#include "../include/Campus.hpp"

static const char* HELP =
    "CampusGuard CLI - Rizal Building (5 floors) + MCL Track Oval\n"
    "  map | tree | search ID_OR_NAME | suggest PREFIX | recent | nextrecent | oval | ranked ID\n"
    "  route ID exit|center [distance] | route ID to DEST_ID | find ID alarm|extinguisher|hose|refuge|exit|center [distance]\n"
    "  hazard ID | hazard ID1 ID2 | undo | status\n"
    "  sos USER NAME NODE KIND | next | register USER NAME NODE | unregister USER | checkin USER\n"
    "  remember ID | addroom ID NAME FLOOR LINK_ID METERS | delroom ID | report | demo | help | quit\n"
    "  Use underscores for spaces; route defaults to fewest hallway connections.\n"
    "  IDs: rooms R200-R214, R301-R314, R400-R412, R405A/B, R501-R503, CR3, FAC3, CLIR3, RC4, LAB4E, LAB4N, AUD5\n"
    "       stairs F<floor>WS/ES/CS/NS, junction F<floor>CJ, corridor F<floor>C1.., exits EXW/EXE/EXN, OVAL\n";

int main() {
    Campus campus; std::string line;
    std::cout << HELP << "> ";
    while (std::getline(std::cin, line)) {
        if (line == "quit") break;
        if (line == "help") std::cout << HELP;
        else if (line == "demo") {                         // scripted walkthrough for the presentation
            const char* script[] = {
                "oval", "route R405A exit", "route R405A center", "find R405A alarm", "find R405A refuge", "hazard EXE", "route R214 center",
                "hazard F2C8 F2ES", "route R214 exit", "status", "undo", "undo", "sos U1 Juan R305 injury", "next", "checkin U1", "report"};
            for (const char* s : script) std::cout << "> " << s << "\n" << campus.exec(s) << "\n";
        } else std::cout << campus.exec(line) << "\n";
        std::cout << "> ";
    }
}
