pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

contract BDBToken is StandardToken {
    
    string public name = "BDB Token";
    string public symbol = "BDBT";
    uint8 public decimals = 2;
    uint public INITIAL_SUPPLY = 100000;

    constructor() public {
    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
    }

}
