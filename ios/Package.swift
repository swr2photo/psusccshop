// swift-tools-version: 6.1
// Compatible with Xcode 26 and iOS 26 SDK

import PackageDescription

let package = Package(
    name: "PSUSCCShop",
    platforms: [
        .iOS(.v26)
    ],
    products: [
        .library(
            name: "PSUSCCShop",
            targets: ["PSUSCCShop"]
        ),
    ],
    dependencies: [
        // No external dependencies - using Apple frameworks only
    ],
    targets: [
        .target(
            name: "PSUSCCShop",
            path: "PSUSCCShop"
        ),
    ]
)
