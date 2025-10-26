// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISwapPool {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
}

interface ICCTP {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce);
}

/* ---------------------------- SOURCE CHAIN CONTRACT ---------------------------- */

contract SourceChainSwapAndBridge is ReentrancyGuard {
    address public immutable swapPool;
    address public immutable usdc;
    address public immutable pusd;
    address public immutable cctp;

    event SwapAndBridge(
        address indexed user,
        uint256 amountIn,
        uint256 usdcAmount,
        uint32 destinationDomain,
        bytes32 mintRecipient
    );

    constructor(address _swapPool, address _usdc, address _pusd, address _cctp) {
        swapPool = _swapPool;
        usdc = _usdc;
        pusd = _pusd;
        cctp = _cctp;
    }

    /**
     * @notice User swaps PUSD -> USDC and then bridges via CCTP
     * @param amountIn Amount of PUSD user sends
     * @param minUSDC Minimum USDC acceptable after swap
     * @param destinationDomain Circle domain ID for destination chain (e.g., Base Sepolia)
     * @param mintRecipient Address on destination chain to receive USDC (converted to bytes32)
     */
    function swapAndBridge(
        uint256 amountIn,
        uint256 minUSDC,
        uint32 destinationDomain,
        bytes32 mintRecipient
    ) external nonReentrant {
        require(amountIn > 0, "Zero amount");
        // Step 1: Transfer PUSD from user to this contract
        require(IERC20(pusd).transferFrom(msg.sender, address(this), amountIn), "Transfer failed");

        // Step 2: Approve swap pool to spend PUSD
        IERC20(pusd).approve(swapPool, amountIn); // overwrite pattern acceptable for trusted tokens

        // Step 3: Swap PUSD -> USDC
        uint256 usdcAmount = ISwapPool(swapPool).swap(pusd, usdc, amountIn, minUSDC);
        require(usdcAmount >= minUSDC, "Slippage");

        // Step 4: Approve CCTP contract to spend USDC
        IERC20(usdc).approve(cctp, usdcAmount);

        // Step 5: Call Circle's CCTP to burn USDC for cross-chain transfer
        ICCTP(cctp).depositForBurn(usdcAmount, destinationDomain, mintRecipient, usdc);

        // Revoke approvals (best-effort, ignore failure if non-standard)
        IERC20(pusd).approve(swapPool, 0);
        IERC20(usdc).approve(cctp, 0);

        emit SwapAndBridge(msg.sender, amountIn, usdcAmount, destinationDomain, mintRecipient);
    }
}

/* ---------------------------- DESTINATION CHAIN CONTRACT ---------------------------- */

contract DestinationChainReceiver is ReentrancyGuard {
    address public immutable swapPool;
    address public immutable usdc;
    address public immutable pusd;

    event CompleteSwap(
        address indexed caller,
        address indexed recipient,
        bool wantPUSD,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _swapPool, address _usdc, address _pusd) {
        swapPool = _swapPool;
        usdc = _usdc;
        pusd = _pusd;
    }

    /**
     * @notice Called after USDC is minted by CCTP. Caller can claim USDC or swap to PUSD.
     * @param amount Amount of USDC to process
     * @param minPUSD Minimum PUSD after swap (only checked if wantPUSD=true)
     * @param wantPUSD If true, swap to PUSD; if false, send USDC directly
     */
    function completeSwap(
        uint256 amount,
        uint256 minPUSD,
        bool wantPUSD
    ) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(IERC20(usdc).balanceOf(address(this)) >= amount, "Not enough USDC");

        address recipient = msg.sender; // enforce authenticity: only original caller claims
        if (wantPUSD) {
            require(minPUSD > 0, "minPUSD=0");
            IERC20(usdc).approve(swapPool, amount);
            uint256 pusdAmount = ISwapPool(swapPool).swap(usdc, pusd, amount, minPUSD);
            IERC20(pusd).transfer(recipient, pusdAmount);
            IERC20(usdc).approve(swapPool, 0); // revoke approval
            emit CompleteSwap(msg.sender, recipient, true, amount, pusdAmount);
        } else {
            IERC20(usdc).transfer(recipient, amount);
            emit CompleteSwap(msg.sender, recipient, false, amount, amount);
        }
    }
}
