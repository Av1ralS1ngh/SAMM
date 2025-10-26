// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OrbitalPool} from "../src/OrbitalPool.sol";
import {X402PaymentAdapter} from "../src/X402PaymentAdapter.sol";
import {X402SessionManager} from "../src/X402SessionManager.sol";
import {StablecoinPriceOracle} from "../src/StablecoinPriceOracle.sol";

/**
 * @notice Unified deployment for development/hackathon
 * Steps:
 * 1. Deploy mock stables (if not using existing testnet addresses)
 * 2. Deploy SessionManager
 * 3. Deploy X402PaymentAdapter (verifier from env)
 * 4. Transfer SessionManager ownership to adapter + set session manager
 * 5. Deploy OrbitalPool with adapter address (enables x402)
 * 6. Deploy StablecoinPriceOracle (pyth core contract address from env) & set feed ids
 */
contract DeployUnified is Script {
    struct StableInfo { string name; string symbol; uint8 decimals; uint256 initial; }

    MockERC20 public usdc;
    MockERC20 public pyusd;
    MockERC20 public usdt;
    MockERC20 public dai;

    OrbitalPool public pool;
    X402SessionManager public sessionManager;
    X402PaymentAdapter public adapter;
    StablecoinPriceOracle public oracle;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);

        // Optional: deploy mocks (skip if providing TOKEN_ADDRESSES env)
        address usdcAddr = _maybeDeployMock("USDC_ADDRESS", "USD Coin", "USDC", 6);
        address pyusdAddr = _maybeDeployMock("PYUSD_ADDRESS", "PayPal USD", "PYUSD", 6);
        address usdtAddr = _maybeDeployMock("USDT_ADDRESS", "Tether USD", "USDT", 6);
        address daiAddr = _maybeDeployMock("DAI_ADDRESS", "Dai Stablecoin", "DAI", 18);

        // Session manager
        sessionManager = new X402SessionManager();
        console.log("SessionManager:", address(sessionManager));

        // Adapter
        address verifier = vm.envAddress("X402_VERIFIER_ADDRESS");
        adapter = new X402PaymentAdapter(verifier);
        console.log("X402PaymentAdapter:", address(adapter));

        // Transfer ownership of session manager to adapter & link
        sessionManager.setOwner(address(adapter));
        adapter.setSessionManager(address(sessionManager));

        // Deploy pool with adapter
        address[] memory tokens = new address[](4);
        tokens[0] = usdcAddr; tokens[1] = pyusdAddr; tokens[2] = usdtAddr; tokens[3] = daiAddr;
        pool = new OrbitalPool(tokens, address(adapter));
        console.log("OrbitalPool:", address(pool));

        // Oracle
        address pythCore = vm.envAddress("PYTH_CORE_ADDRESS");
        oracle = new StablecoinPriceOracle(pythCore);
        console.log("StablecoinPriceOracle:", address(oracle));

        // Set feed ids if provided (env vars optional)
        _trySetFeed(usdcAddr, "PYTH_FEED_USDC");
        _trySetFeed(pyusdAddr, "PYTH_FEED_PYUSD");
        _trySetFeed(usdtAddr, "PYTH_FEED_USDT");
        _trySetFeed(daiAddr, "PYTH_FEED_DAI");

        vm.stopBroadcast();
    }

    function _maybeDeployMock(string memory envName, string memory name, string memory symbol, uint8 decimals) internal returns (address) {
        (bool ok, bytes memory data) = address(vm).staticcall(abi.encodeWithSignature("envOr(string,string)", envName, ""));
        // If forge fails to support envOr fallback we proceed to deploy (simplify)
        address existing = address(0);
        if (ok && data.length == 32) {
            existing = abi.decode(data, (address));
        }
        if (existing != address(0)) return existing;
        uint256 initial = decimals == 6 ? 1_000_000 * 1e6 : 1_000_000 * 1e18;
        MockERC20 token = new MockERC20(name, symbol, decimals, initial);
        console.log(string(abi.encodePacked(symbol, " deployed:")), address(token));
        return address(token);
    }

    function _trySetFeed(address token, string memory envKey) internal {
        bytes32 feedId;
        try vm.envBytes32(envKey) returns (bytes32 f) { feedId = f; } catch { return; }
        if (feedId != bytes32(0)) {
            oracle.setFeed(token, feedId);
            console.log("Feed set token", token);
            console.logBytes32(feedId);
        }
    }
}
