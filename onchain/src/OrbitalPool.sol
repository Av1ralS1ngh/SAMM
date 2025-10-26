// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./X402PaymentAdapter.sol";

contract OrbitalPool is ReentrancyGuard, Ownable {
    struct Tick { uint256 radius; uint256 planeConstant; bool isInterior; uint256[] reserves; address owner; bool active; }
    IERC20[] public tokens; uint256 public tokenCount; Tick[] public ticks; mapping(address=>uint256[]) public userTicks; uint256[] internal poolReserves;
    uint256 public constant FEE_DENOMINATOR=10000; uint256 public swapFee=30; //0.30%
    X402PaymentAdapter public x402PaymentAdapter; bool public x402PaymentRequired;

    event LiquidityAdded(address indexed provider,uint256 tickIndex,uint256 radius);
    event LiquidityRemoved(address indexed provider,uint256 tickIndex,uint256 fraction);
    event Swap(address indexed trader,uint256 tokenIn,uint256 tokenOut,uint256 amountIn,uint256 amountOut);

    modifier validTokenIndex(uint256 i){require(i<tokenCount,"idx");_;}
    modifier validTickIndex(uint256 i){require(i<ticks.length && ticks[i].active,"tick");_;}

    constructor(address[] memory _tokens,address _x402) Ownable(msg.sender){
        tokenCount=_tokens.length; require(tokenCount>=2,"min2"); for(uint256 i=0;i<tokenCount;i++){tokens.push(IERC20(_tokens[i]));}
        poolReserves=new uint256[](tokenCount); if(_x402!=address(0)){x402PaymentAdapter=X402PaymentAdapter(_x402); x402PaymentRequired=true;}
    }

    function addLiquidity(uint256[] memory amounts,uint256 planeConstant) external nonReentrant returns(uint256 idx){
        require(amounts.length==tokenCount,"len"); uint256 radius; for(uint256 i=0;i<tokenCount;i++){uint256 a=amounts[i]; if(a>0){tokens[i].transferFrom(msg.sender,address(this),a); poolReserves[i]+=a; radius+=a;}}
        require(radius>0,"zero"); ticks.push(Tick(radius,planeConstant,true,amounts,msg.sender,true)); idx=ticks.length-1; userTicks[msg.sender].push(idx); emit LiquidityAdded(msg.sender,idx,radius);
    }

    function removeLiquidity(uint256 idx,uint256 fraction) external nonReentrant validTickIndex(idx) returns(uint256[] memory amts){
        require(fraction<=1e18,"frac"); Tick storage t=ticks[idx]; require(t.owner==msg.sender,"owner"); amts=new uint256[](tokenCount); for(uint256 i=0;i<tokenCount;i++){uint256 part=(t.reserves[i]*fraction)/1e18; if(part>0){t.reserves[i]-=part; poolReserves[i]-=part; tokens[i].transfer(msg.sender,part); amts[i]=part;}} t.radius=(t.radius*(1e18-fraction))/1e18; if(t.radius==0) t.active=false; emit LiquidityRemoved(msg.sender,idx,fraction);
    }

    function swap(uint256 tokenIn,uint256 tokenOut,uint256 amountIn,uint256 minAmountOut) external nonReentrant validTokenIndex(tokenIn) validTokenIndex(tokenOut) returns(uint256 out){ out=_executeSwap(tokenIn,tokenOut,amountIn,minAmountOut); }
    function _executeSwap(uint256 tokenIn,uint256 tokenOut,uint256 amountIn,uint256 minAmountOut) internal returns(uint256 out){ require(tokenIn!=tokenOut,"same"); require(amountIn>0,"zero"); tokens[tokenIn].transferFrom(msg.sender,address(this),amountIn); uint256 inAfter=(amountIn*(FEE_DENOMINATOR-swapFee))/FEE_DENOMINATOR; uint256 rIn=poolReserves[tokenIn]; uint256 rOut=poolReserves[tokenOut]; require(rOut>0,"liq"); out=(inAfter*rOut)/(rIn+inAfter); require(out>=minAmountOut,"slip"); poolReserves[tokenIn]=rIn+inAfter; poolReserves[tokenOut]=rOut-out; tokens[tokenOut].transfer(msg.sender,out); emit Swap(msg.sender,tokenIn,tokenOut,amountIn,out); }

    // Views
    function getReserves() external view returns(uint256[] memory r){ r=poolReserves; }
    function getAmountOut(uint256 tokenIn,uint256 tokenOut,uint256 amountIn) external view validTokenIndex(tokenIn) validTokenIndex(tokenOut) returns(uint256){ if(tokenIn==tokenOut) return 0; uint256 rIn=poolReserves[tokenIn]; uint256 rOut=poolReserves[tokenOut]; if(rIn==0||rOut==0) return 0; uint256 inAfter=(amountIn*(FEE_DENOMINATOR-swapFee))/FEE_DENOMINATOR; return (inAfter*rOut)/(rIn+inAfter); }
    function getSpotPrice(uint256 tokenA,uint256 tokenB) external view validTokenIndex(tokenA) validTokenIndex(tokenB) returns(uint256){ uint256 rA=poolReserves[tokenA]; uint256 rB=poolReserves[tokenB]; if(rA==0) return type(uint256).max; return (rB*1e18)/rA; }
    function getTickInfo(uint256 idx) external view validTickIndex(idx) returns(uint256,uint256,bool,address,uint256[] memory){ Tick storage t=ticks[idx]; return (t.radius,t.planeConstant,t.isInterior,t.owner,t.reserves); }
    function getUserTicks(address u) external view returns(uint256[] memory){ return userTicks[u]; }
    function getTickEfficiency(uint256 idx) external view validTickIndex(idx) returns(uint256){ Tick storage t=ticks[idx]; if(t.radius==0) return 0; return (t.radius*1e18)/(t.planeConstant+1); }

    // Admin
    function setSwapFee(uint256 f) external onlyOwner { require(f<=100,"fee"); swapFee=f; }
    function emergencyWithdraw(address token,uint256 amt) external onlyOwner { IERC20(token).transfer(msg.sender,amt); }

    // x402 helpers for extension
    function _swapWithX402PaymentInternal(uint256 tokenIn,uint256 tokenOut,uint256 amountIn,uint256 minAmountOut,bytes32 paymentId,bytes calldata proof) internal returns(uint256){
        require(x402PaymentRequired,"x402"); _verifyPayment(paymentId,proof,amountIn,tokenIn); return _executeSwap(tokenIn,tokenOut,amountIn,minAmountOut);
    }
    function _swapWithX402SessionInternal(uint256 tokenIn,uint256 tokenOut,uint256 amountIn,uint256 minAmountOut,bytes32 sessionId,bytes32 paymentId,bytes calldata proof,address user) internal returns(uint256){
        require(x402PaymentRequired,"x402"); _verifySession(paymentId,sessionId,proof,amountIn,user,tokenIn); return _executeSwap(tokenIn,tokenOut,amountIn,minAmountOut);
    }
    function _verifyPayment(bytes32 paymentId,bytes calldata proof,uint256 amountIn,uint256 tokenIn) internal {
        bool ok = x402PaymentAdapter.verifyAndMarkPayment(paymentId, proof, amountIn, address(tokens[tokenIn])); require(ok,"pay");
    }
    function _verifySession(bytes32 paymentId,bytes32 sessionId,bytes calldata proof,uint256 amountIn,address user,uint256 tokenIn) internal {
        bool ok = x402PaymentAdapter.verifyAndDebit(paymentId, sessionId, proof, amountIn, user, address(tokens[tokenIn])); require(ok,"sess");
    }
}