// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";
import "../src/OrbitalPool.sol";

contract DeployTestnetStablecoins is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock stablecoins
        MockERC20 mockUSDC = new MockERC20("USD Coin", "USDC", 6, 1_000_000 * 1e6);  // USDC has 6 decimals
        MockERC20 mockPYUSD = new MockERC20("PayPal USD", "PYUSD", 6, 1_000_000 * 1e6);
        MockERC20 mockUSDT = new MockERC20("Tether USD", "USDT", 6, 1_000_000 * 1e6);
        MockERC20 mockDAI = new MockERC20("Dai Stablecoin", "DAI", 18, 1_000_000 * 1e18);  // DAI has 18 decimals

        console.log("Mock USDC deployed to:", address(mockUSDC));
        console.log("Mock PYUSD deployed to:", address(mockPYUSD));
        console.log("Mock USDT deployed to:", address(mockUSDT));
        console.log("Mock DAI deployed to:", address(mockDAI));

        // Create token array for OrbitalPool
        address[] memory tokens = new address[](4);
        tokens[0] = address(mockUSDC);
        tokens[1] = address(mockPYUSD);
        tokens[2] = address(mockUSDT);
        tokens[3] = address(mockDAI);

        // Deploy OrbitalPool with the mock tokens
    OrbitalPool pool = new OrbitalPool(tokens, address(0));
        console.log("OrbitalPool deployed to:", address(pool));

        // Mint some initial tokens to the deployer
        uint256 initialAmount = 10_000;  // 10,000 units of each token
        mockUSDC.transfer(msg.sender, initialAmount * 1e6);
        mockPYUSD.transfer(msg.sender, initialAmount * 1e6);
        mockUSDT.transfer(msg.sender, initialAmount * 1e6);
        mockDAI.transfer(msg.sender, initialAmount * 1e18);

        vm.stopBroadcast();
    }
}