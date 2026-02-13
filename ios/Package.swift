// swift-tools-version: 5.9
// Compatible with Xcode 15+ and iOS 17+ SDK

import PackageDescription

let package = Package(
    name: "PSUSCCShop",
    platforms: [
        .iOS(.v17)
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
