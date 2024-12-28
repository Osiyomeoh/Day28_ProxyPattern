// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title StorageSlot
 * @dev Library for reading and writing primitive types to specific storage slots
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly {
            r.slot := slot
        }
    }
}

/**
 * @title Proxy
 * @dev Implements upgradeability using the proxy pattern
 */
contract Proxy {
    // keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    // keccak-256 hash of "eip1967.proxy.admin" subtracted by 1
    bytes32 private constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @dev Constructor sets the admin
     */
    constructor() {
        _setAdmin(msg.sender);
    }

    /**
     * @dev Modifier ensuring the caller is the admin
     */
    modifier ifAdmin() {
        if (msg.sender == _getAdmin()) {
            _;
        } else {
            _fallback();
        }
    }

    /**
     * @dev Returns the current implementation address
     */
    function _implementation() internal view returns (address) {
        return StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value;
    }

    /**
     * @dev Returns the current admin
     */
    function _getAdmin() internal view returns (address) {
        return StorageSlot.getAddressSlot(ADMIN_SLOT).value;
    }

    /**
     * @dev Updates the implementation address
     */
    function _setImplementation(address newImplementation) private {
        require(newImplementation.code.length > 0, "Invalid implementation");
        StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = newImplementation;
    }

    /**
     * @dev Updates the admin address
     */
    function _setAdmin(address newAdmin) private {
        StorageSlot.getAddressSlot(ADMIN_SLOT).value = newAdmin;
    }

    /**
     * @dev Admin function to update the implementation
     */
    function upgradeTo(address newImplementation) external ifAdmin {
        _setImplementation(newImplementation);
    }

    /**
     * @dev Admin function to change the admin
     */
    function changeAdmin(address newAdmin) external ifAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        _setAdmin(newAdmin);
    }

    /**
     * @dev Fallback function that delegates calls to the implementation
     */
    function _fallback() internal {
        _delegate(_implementation());
    }

    /**
     * @dev Delegates the current call to implementation
     */
    function _delegate(address implementation) internal {
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    fallback() external payable {
        _fallback();
    }

    receive() external payable {
        _fallback();
    }
}

/**
 * @title CounterV1
 * @dev First implementation of the counter contract
 */
contract CounterV1 {
    // Storage layout must be the same for all versions
    uint256 private _count;
    
    event CountUpdated(uint256 newCount);
    
    function increment() external {
        _count += 1;
        emit CountUpdated(_count);
    }
    
    function getCount() external view returns (uint256) {
        return _count;
    }
}

/**
 * @title CounterV2
 * @dev Upgraded version with additional functionality
 */
contract CounterV2 {
    // Storage layout must remain the same
    uint256 private _count;
    
    event CountUpdated(uint256 newCount);
    event DecrementedCount(uint256 newCount);
    
    function increment() external {
        _count += 1;
        emit CountUpdated(_count);
    }
    
    function decrement() external {
        require(_count > 0, "Count cannot be negative");
        _count -= 1;
        emit DecrementedCount(_count);
    }
    
    function getCount() external view returns (uint256) {
        return _count;
    }

    function incrementBy(uint256 amount) external {
        _count += amount;
        emit CountUpdated(_count);
    }
}