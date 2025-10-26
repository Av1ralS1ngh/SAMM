// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {X402PaymentAdapter} from "../src/X402PaymentAdapter.sol";
import "forge-std/Script.sol";

contract DeployX402 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy X402 Payment Adapter
        address x402Verifier = vm.envAddress("X402_VERIFIER_ADDRESS");
        X402PaymentAdapter adapter = new X402PaymentAdapter(x402Verifier);
        
        console.log("X402PaymentAdapter deployed to:", address(adapter));

        vm.stopBroadcast();
    }
}