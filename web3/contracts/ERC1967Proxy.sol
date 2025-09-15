// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Re-export the OpenZeppelin ERC1967Proxy for easier testing
contract TestERC1967Proxy is ERC1967Proxy {
    constructor(
        address implementation,
        bytes memory _data
    ) ERC1967Proxy(implementation, _data) {}
}
