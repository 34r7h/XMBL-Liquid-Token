// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockYieldProtocol {
    string public name;
    string public apy;

    constructor(string memory _name, string memory _apy) {
        name = _name;
        apy = _apy;
    }

    // Add any mock functions needed for testing
}
