// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IX402Verifier} from "../../src/interfaces/IX402Verifier.sol";

contract MockX402Verifier is IX402Verifier {
    mapping(bytes32 => bool) public valid;
    function setValid(bytes32 paymentId, bool v) external { valid[paymentId] = v; }
    function verifyPayment(bytes32 paymentId, bytes calldata, uint256, address) external view returns (bool) {
        return valid[paymentId];
    }
}
