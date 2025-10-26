// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OrbitalPool} from "../src/OrbitalPool.sol";
import {X402SessionManager} from "../src/X402SessionManager.sol";
import {X402PaymentAdapter} from "../src/X402PaymentAdapter.sol";

/**
 * @title DeployAll
 * @notice Minimal unified deployment (two mock tokens + session manager + payment adapter + pool)
 * @dev Cross-chain contracts and extra tokens omitted per scope clarification.
 * Environment Variables:
 *   PRIVATE_KEY (uint)                 - Deployer key
 *   VERIFIER_ADDRESS (address optional)- x402 verifier address; 0x0 if not ready
 *   REQUIRE_X402 (string optional)     - "true"/"false" (default true)
 *   TOKEN0_NAME / TOKEN0_SYMBOL / TOKEN0_DECIMALS / TOKEN0_SUPPLY
 *   TOKEN1_NAME / TOKEN1_SYMBOL / TOKEN1_DECIMALS / TOKEN1_SUPPLY
 */
contract DeployAll is Script {
    struct Output { address token0; address token1; address sessionManager; address paymentAdapter; address pool; }

    function run() external returns (Output memory out) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address verifier = vm.envOr("VERIFIER_ADDRESS", address(0));
        bool requireX402 = _parseBool(vm.envOr("REQUIRE_X402", string("true")));

        (string memory n0,string memory s0,uint8 d0,uint256 sup0) = _tokenEnv(0);
        (string memory n1,string memory s1,uint8 d1,uint256 sup1) = _tokenEnv(1);

        vm.startBroadcast(pk);

        MockERC20 t0 = new MockERC20(n0,s0,d0,sup0);
        MockERC20 t1 = new MockERC20(n1,s1,d1,sup1);

        X402SessionManager session = new X402SessionManager();
        X402PaymentAdapter adapter = new X402PaymentAdapter(verifier);
        session.setOwner(address(adapter)); // delegate session consumption rights

        address[] memory toks = new address[](2);
        toks[0] = address(t0);
        toks[1] = address(t1);
        address adapterAddr = requireX402 ? address(adapter) : address(0);
        OrbitalPool pool = new OrbitalPool(toks, adapterAddr);

        vm.stopBroadcast();

    // Serialize addresses into a single JSON string for easy parsing.
    // vm.serialize* returns a JSON string only for the last call per root key.
    string memory root = "deploy";
    vm.serializeAddress(root, "token0", address(t0));
    vm.serializeAddress(root, "token1", address(t1));
    vm.serializeAddress(root, "sessionManager", address(session));
    vm.serializeAddress(root, "paymentAdapter", address(adapter));
    string memory jsonOut = vm.serializeAddress(root, "pool", address(pool));
    console2.log(jsonOut);

        out = Output({
            token0: address(t0),
            token1: address(t1),
            sessionManager: address(session),
            paymentAdapter: address(adapter),
            pool: address(pool)
        });
    }

    function _tokenEnv(uint8 index) internal returns (string memory name_, string memory symbol_, uint8 decimals_, uint256 supply_) {
        string memory ix = index == 0 ? "0" : "1";
        name_ = vm.envOr(string.concat("TOKEN", ix, "_NAME"), string.concat("Token", ix));
        symbol_ = vm.envOr(string.concat("TOKEN", ix, "_SYMBOL"), string.concat("TK", ix));
        decimals_ = uint8(vm.parseUint(vm.envOr(string.concat("TOKEN", ix, "_DECIMALS"), string("18"))));
        supply_ = vm.parseUint(vm.envOr(string.concat("TOKEN", ix, "_SUPPLY"), string("1000000000000000000000000"))); // 1M * 1e18
    }

    function _parseBool(string memory v) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(_lower(v)));
        return h == keccak256("true") || h == keccak256("1") || h == keccak256("yes");
    }

    function _lower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for(uint256 i; i<b.length; i++){ uint8 c = uint8(b[i]); if(c>=65 && c<=90){ b[i] = bytes1(c+32);} }
        return string(b);
    }
}