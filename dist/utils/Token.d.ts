import { UserOperation } from "../entity/userOperation";
import { ethers } from "ethers";
import { NumberLike } from "../defines/numberLike";
import { IApproveToken } from "../interface/IApproveToken";
export declare class Token {
    createOp(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAndData: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, callContract: string, encodeABI: string, value?: string): Promise<UserOperation | null>;
}
export declare class ERC20 {
    private _token;
    constructor();
    private getContract;
    approve(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _spender: string, _value: string): Promise<UserOperation | null>;
    private readonly MAX_INT256;
    private approveGasLimit;
    getApproveCallData(etherProvider: ethers.providers.BaseProvider, walletAddress: string, approveData: IApproveToken[]): Promise<{
        callData: string;
        callGasLimit: string;
    }>;
    transferFrom(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _from: string, _to: string, _value: string): Promise<UserOperation | null>;
    transfer(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _to: string, _value: string): Promise<UserOperation | null>;
}
export declare class ERC721 {
    private _token;
    constructor();
    private getContract;
    approve(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _spender: string, _tokenId: string): Promise<UserOperation | null>;
    transferFrom(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _from: string, _to: string, _tokenId: string): Promise<UserOperation | null>;
    transfer(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _to: string, _tokenId: string): Promise<UserOperation | null>;
    safeTransferFrom(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _from: string, _to: string, _tokenId: string): Promise<UserOperation | null>;
    setApprovalForAll(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _operator: string, _approved: boolean): Promise<UserOperation | null>;
}
export declare class ERC1155 {
    private _token;
    constructor();
    private getContract;
    safeTransferFrom(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _from: string, _to: string, _id: string, _value: string, _data: string): Promise<UserOperation | null>;
    safeBatchTransferFrom(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _from: string, _to: string, _ids: string, _values: string, _data: string): Promise<UserOperation | null>;
    setApprovalForAll(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, _token: string, _operator: string, _approved: boolean): Promise<UserOperation | null>;
}
export declare class ETH {
    private _token;
    constructor();
    transfer(etherProvider: ethers.providers.BaseProvider, walletAddress: string, nonce: NumberLike, entryPointAddress: string, paymasterAddress: string, maxFeePerGas: NumberLike, maxPriorityFeePerGas: NumberLike, to: string, value: string): Promise<UserOperation | null>;
}
