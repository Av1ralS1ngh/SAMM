// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StablecoinPriceOracle} from "../src/StablecoinPriceOracle.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract StablecoinPriceOracleTest is Test {
    StablecoinPriceOracle oracle;
    MockPyth mockPyth;
    MockERC20 usdc;
    MockERC20 dai;

    bytes32 constant FEED_USDC = keccak256("pyth-usdc");
    bytes32 constant FEED_DAI  = keccak256("pyth-dai");

    function setUp() public {
        mockPyth = new MockPyth();
        oracle = new StablecoinPriceOracle(address(mockPyth));
        usdc = new MockERC20("USD Coin","USDC",6,1_000_000*1e6);
        dai = new MockERC20("Dai","DAI",18,1_000_000*1e18);
        oracle.setFeed(address(usdc), FEED_USDC);
        oracle.setFeed(address(dai), FEED_DAI);
    }

    function testNormalizationSameExpo() public {
        // expo -8 -> already at 1e-8 scaling
        mockPyth.setPrice(FEED_USDC, int64(100000000), -8, uint64(block.timestamp), 1000); // $1.00000000
        bytes[] memory updates = new bytes[](1); // content irrelevant for mock
        bytes32[] memory feeds = new bytes32[](2);
        feeds[0]=FEED_USDC; feeds[1]=FEED_DAI; // DAI not set yet but we will set after
        // Set DAI too
        mockPyth.setPrice(FEED_DAI, int64(99950000), -8, uint64(block.timestamp), 1500); // $0.99950000

        uint256 fee = mockPyth.getUpdateFee(updates);
        oracle.updatePrices{value: fee}(updates, feeds);

        StablecoinPriceOracle.StoredPrice memory pUsdc = oracle.getPriceByToken(address(usdc));
        assertEq(pUsdc.price, 100000000);
        assertEq(pUsdc.expo, -8);
        assertGt(pUsdc.lastUpdate, 0);
    }

    function testNormalizationDifferentExpo() public {
        // Provide USDC price with expo -6 meaning price=1.000000 * 1e-6 -> 1000000 raw; should scale to 1e8 = 100000000 after +2 exponent shift
        mockPyth.setPrice(FEED_USDC, int64(1_000_000), -6, uint64(block.timestamp), 500); // 1.000000
        bytes[] memory updates = new bytes[](1);
        bytes32[] memory feeds = new bytes32[](1);
        feeds[0] = FEED_USDC;
        uint256 fee = mockPyth.getUpdateFee(updates);
        oracle.updatePrices{value: fee}(updates, feeds);
        StablecoinPriceOracle.StoredPrice memory p = oracle.getPrice(FEED_USDC);
        assertEq(p.price, 100_000_000, "Normalization failed");
    }

    function testRefundDust() public {
        mockPyth.setPrice(FEED_USDC, int64(100000000), -8, uint64(block.timestamp), 1000);
        bytes[] memory updates = new bytes[](1);
        bytes32[] memory feeds = new bytes32[](1);
        feeds[0]=FEED_USDC;
        uint256 fee = mockPyth.getUpdateFee(updates);
        uint256 overpay = fee + 0.0005 ether;
        uint256 balBefore = address(this).balance;
        oracle.updatePrices{value: overpay}(updates, feeds);
        uint256 balAfter = address(this).balance;
        // Ensure we only spent >= fee and <= overpay (some gas diff ignored) just check refund logic executed by approx difference
        assertGt(balAfter, balBefore - overpay, "No refund");
    }

    // Receive ether for refund tests
    receive() external payable {}
}
