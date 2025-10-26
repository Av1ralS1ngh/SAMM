// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {OrbitalPoolX402Extension} from "../src/OrbitalPoolX402Extension.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {X402PaymentAdapter} from "../src/X402PaymentAdapter.sol";
import {X402SessionManager} from "../src/X402SessionManager.sol";
import {MockX402Verifier} from "./mocks/MockX402Verifier.sol";

contract OrbitalPoolX402SessionTest is Test {
    OrbitalPoolX402Extension pool;
    MockERC20 token0;
    MockERC20 token1;
    MockERC20 token2;
    MockERC20 token3;

    X402PaymentAdapter adapter;
    X402SessionManager sessionMgr;
    MockX402Verifier verifier;

    address user = address(0x111);
    address agent = address(0x222);

    uint256 constant SUPPLY6 = 1_000_000 * 1e6;
    uint256 constant LIQ = 50_000 * 1e6;

    function setUp() public {
        // Tokens
        token0 = new MockERC20("USDC","USDC",6,SUPPLY6);
        token1 = new MockERC20("PYUSD","PYUSD",6,SUPPLY6);
        token2 = new MockERC20("USDT","USDT",6,SUPPLY6);
        token3 = new MockERC20("DAI","DAI",6,SUPPLY6);

        // Verifier + adapter + session manager
        verifier = new MockX402Verifier();
        adapter = new X402PaymentAdapter(address(verifier));
        sessionMgr = new X402SessionManager();
        sessionMgr.setOwner(address(adapter));
        adapter.setSessionManager(address(sessionMgr));

        // Pool
        address[] memory toks = new address[](4);
        toks[0]=address(token0); toks[1]=address(token1); toks[2]=address(token2); toks[3]=address(token3);
    pool = new OrbitalPoolX402Extension(toks, address(adapter));

        // Provide liquidity from user
        token0.transfer(user, LIQ);
        token1.transfer(user, LIQ);
        token2.transfer(user, LIQ);
        token3.transfer(user, LIQ);

        vm.startPrank(user);
        token0.approve(address(pool), LIQ);
        token1.approve(address(pool), LIQ);
        token2.approve(address(pool), LIQ);
        token3.approve(address(pool), LIQ);
        uint256[] memory amounts = new uint256[](4);
        amounts[0]=LIQ; amounts[1]=LIQ; amounts[2]=LIQ; amounts[3]=LIQ;
        pool.addLiquidity(amounts, LIQ/2);
        vm.stopPrank();
    }

    function _createSession(bytes32 sessionId, uint256 allowance, uint64 ttl) internal {
        // adapter owns session manager so we need to impersonate adapter owner (adapter owner is deployer of adapter (this contract address))
        // In this setup adapter.owner() == address(this)
        sessionMgr.createSession(sessionId, user, allowance, uint64(block.timestamp)+ttl);
    }

    function testSessionSwap() public {
        bytes32 sessionId = keccak256("session-1");
        uint256 allowance = 1_000 * 1e6; // allowance denominated in token units
        _createSession(sessionId, allowance, 3600);

        // Mark paymentId valid in verifier
        bytes32 paymentId = keccak256("payment-1");
        verifier.setValid(paymentId, true);

        // Fund agent with input token (simulate agent executing on behalf of user or user themselves) -> we'll give agent tokens & approvals
        token0.transfer(agent, 1_000 * 1e6);
        vm.startPrank(agent);
        token0.approve(address(pool), 1_000 * 1e6);

        // Perform session based swap token0 -> token1
        uint256 amountIn = 100 * 1e6;
        uint256 out = pool.swapWithX402Session(
            0,
            1,
            amountIn,
            1, // min out
            sessionId,
            paymentId,
            hex"", // proof empty for mock
            user
        );
        vm.stopPrank();

        assertGt(out, 0, "No output");
        // Remaining allowance should be debited (allowance - amountIn)
        uint256 remaining = sessionMgr.remaining(sessionId);
        assertEq(remaining, allowance - amountIn, "Allowance not debited");

        // Reuse of same paymentId should fail
        vm.startPrank(agent);
        token0.approve(address(pool), amountIn);
        vm.expectRevert();
        pool.swapWithX402Session(0,1,amountIn,1,sessionId,paymentId,hex"",user);
        vm.stopPrank();
    }
}
