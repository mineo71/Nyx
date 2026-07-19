import Cocoa

// NX_KEYTYPE_PLAY = 16. Post a system-defined media key event (down then up).
func postMediaKey(_ keyCode: Int32) {
    for isDown in [true, false] {
        let flags = NSEvent.ModifierFlags(rawValue: isDown ? 0xa00 : 0xb00)
        let data1 = Int((keyCode << 16) | ((isDown ? 0xa : 0xb) << 8))
        guard let event = NSEvent.otherEvent(
            with: .systemDefined,
            location: .zero,
            modifierFlags: flags,
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            subtype: 8,
            data1: data1,
            data2: -1
        ) else { continue }
        event.cgEvent?.post(tap: .cghidEventTap)
    }
}

postMediaKey(16) // NX_KEYTYPE_PLAY
