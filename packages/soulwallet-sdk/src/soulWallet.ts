import { ethers } from "ethers";
import { GuardHookInputData, ISoulWallet, UserOperation } from "./interface/ISoulWallet.js";
import { TypeGuard } from "./tools/typeGuard.js";
import { StorageCache } from "./tools/storageCache.js";
import { ABI_SoulWalletFactory, ABI_SoulWallet, ABI_EntryPoint } from "@soulwallet/abi";
import { getUserOpHash } from '@account-abstraction/utils'
import { L1KeyStore } from "./L1KeyStore.js";
import { HookInputData, Signature } from "./tools/signature.js";
import { Hex } from "./tools/hex.js";
import { GasOverhead } from "./tools/gasOverhead.js";
import { UserOpErrors, UserOpErrorCodes } from "./interface/IUserOpErrors.js";
import { Bundler } from "./bundler.js";

export class onChainConfig {
    chainId: number = 0;
    entryPoint: string = "";
    soulWalletLogic: string = "";
}


export class SoulWallet extends ISoulWallet {
    readonly days = 86400;
    readonly defalutInitialGuardianSafePeriod = 2 * this.days;

    readonly provider: ethers.JsonRpcProvider;
    readonly bundler: ethers.JsonRpcProvider;
    readonly soulWalletFactoryAddress: string;
    readonly defalutCallbackHandlerAddress: string;
    readonly keyStoreModuleAddress: string;
    readonly securityControlModuleAddress: string;

    readonly preVerificationGasDeploy: number = 10000000;

    readonly Bundler: Bundler;


    constructor(
        _provider: string,
        _bundler: string,
        _soulWalletFactoryAddress: string,
        _defalutCallbackHandlerAddress: string,
        _keyStoreModuleAddress: string,
        _securityControlModuleAddress: string,

    ) {
        super();
        TypeGuard.httpOrHttps(_provider);
        TypeGuard.httpOrHttps(_bundler);
        TypeGuard.onlyAddress(_soulWalletFactoryAddress);
        TypeGuard.onlyAddress(_defalutCallbackHandlerAddress);
        TypeGuard.onlyAddress(_keyStoreModuleAddress);
        TypeGuard.onlyAddress(_securityControlModuleAddress);

        this.provider = new ethers.JsonRpcProvider(_provider);
        this.bundler = new ethers.JsonRpcProvider(_bundler);
        this.soulWalletFactoryAddress = _soulWalletFactoryAddress;
        this.defalutCallbackHandlerAddress = _defalutCallbackHandlerAddress;
        this.keyStoreModuleAddress = _keyStoreModuleAddress;
        this.securityControlModuleAddress = _securityControlModuleAddress;

        this.Bundler = new Bundler(this.bundler);
    }


    async getOnChainConfig(): Promise<onChainConfig> {
        const key = `onChainConfig_${this.soulWalletFactoryAddress}`;
        // read from cache
        let _onChainConfig = StorageCache.getInstance().get<onChainConfig | undefined>(key, undefined);
        if (!_onChainConfig) {
            const _soulWalletFactory = new ethers.Contract(this.soulWalletFactoryAddress, ABI_SoulWalletFactory, this.provider);
            const soulWalletLogic: string = await _soulWalletFactory.getFunction("walletImpl").staticCall();
            const _soulWallet = new ethers.Contract(soulWalletLogic, ABI_SoulWallet, this.provider);
            const entryPoint: string = await _soulWallet.getFunction("entryPoint").staticCall();

            _onChainConfig = new onChainConfig();

            const _chainIdBigint = (await this.provider.getNetwork()).chainId;
            const _chainId: number = Number(_chainIdBigint);
            if (Number.isSafeInteger(_chainId)) {
                if (_chainId === 0) {
                    throw new Error("Invalid chainId");
                }
            } else {
                throw new Error("chainId is not a safe integer");
            }

            const _bundlerChainIdBigint = (await this.bundler.getNetwork()).chainId;
            const _bundlerChainId: number = Number(_bundlerChainIdBigint);
            if (Number.isSafeInteger(_bundlerChainId)) {
                if (_bundlerChainId === 0) {
                    throw new Error("Invalid chainId");
                }
            } else {
                throw new Error("chainId is not a safe integer");
            }

            if (_chainId !== _bundlerChainId) {
                throw new Error("chainId mismatch");
            }

            _onChainConfig.chainId = _chainId;
            _onChainConfig.entryPoint = entryPoint;
            _onChainConfig.soulWalletLogic = soulWalletLogic;

            // save to cache
            StorageCache.getInstance().set(key, _onChainConfig);

            // check bundler RPC
            const ret = await this.Bundler.eth_supportedEntryPoints();
            if (!ret.succ) {
                throw new Error("Bundler RPC error");
            }
            if (ret.result!.join().toLowerCase().indexOf(entryPoint.toLowerCase()) === -1) {
                throw new Error(
                    `Bundler network doesn't support entryPoint ${entryPoint}`
                );
            }
        }
        return _onChainConfig;
    }

    async entryPoint(): Promise<string> {
        const _onChainConfig = await this.getOnChainConfig();
        return _onChainConfig.entryPoint;
    }

    async initializeData(initialKey: string, initialGuardianHash: string, initialGuardianSafePeriod: number = this.defalutInitialGuardianSafePeriod) {
        /* 
            function initialize(
                address anOwner,
                address defalutCallbackHandler,
                bytes[] calldata modules,
                bytes[] calldata plugins
            )
        */

        // default dely time is 2 days
        const securityControlModuleAndData = (this.securityControlModuleAddress + Hex.paddingZero(this.defalutInitialGuardianSafePeriod, 32).substring(2)).toLowerCase();
        /* 
         (bytes32 initialKey, bytes32 initialGuardianHash, uint64 guardianSafePeriod) = abi.decode(_data, (bytes32, bytes32, uint64));
        */
        const _initialKey = Hex.paddingZero(initialKey, 32)
        const keyStoreInitData = new ethers.AbiCoder().encode(["bytes32", "bytes32", "uint64"], [_initialKey, initialGuardianHash, initialGuardianSafePeriod]);
        const keyStoreModuleAndData = (this.keyStoreModuleAddress + keyStoreInitData.substring(2)).toLowerCase();

        const _onChainConfig = await this.getOnChainConfig();
        const _soulWallet = new ethers.Contract(_onChainConfig.soulWalletLogic, ABI_SoulWallet, this.provider);
        const initializeData = _soulWallet.interface.encodeFunctionData("initialize", [
            initialKey,
            this.defalutCallbackHandlerAddress,
            [
                securityControlModuleAndData,
                keyStoreModuleAndData
            ],
            []
        ]
        );

        return initializeData;
    }


    async calcWalletAddress(
        index: number,
        initialKey: string,
        initialGuardianHash: string,
        initialGuardianSafePeriod?: number
    ): Promise<string> {
        //const keyStoreSlot = L1KeyStore.getSlot(initialKey, initialGuardianHash, initialGuardianSafePeriod);
        const _initializeData = await this.initializeData(initialKey, initialGuardianHash, initialGuardianSafePeriod);
        const _soulWallet = new ethers.Contract(this.soulWalletFactoryAddress, ABI_SoulWalletFactory, this.provider);
        /* 
         function getWalletAddress(bytes memory _initializer, bytes32 _salt) external view returns (address proxy)
        */
        // number to bytes32 string, e.g: 1 -> 0x0000000000000000000000000000000000000000000000000000000000000001
        const _salt = Hex.paddingZero(index, 32);
        const _walletAddress = await _soulWallet.getFunction("getWalletAddress").staticCall(_initializeData, _salt);
        return _walletAddress;
    }

    async preFund(userOp: UserOperation): Promise<{
        deposit: string,
        prefund: string,
        missfund: string
    }> {
        /*
        function _getRequiredPrefund(MemoryUserOp memory mUserOp) internal pure returns (uint256 requiredPrefund) {
        unchecked {
            //when using a Paymaster, the verificationGasLimit is used also to as a limit for the postOp call.
            // our security model might call postOp eventually twice
            uint256 mul = mUserOp.paymaster != address(0) ? 3 : 1;
            uint256 requiredGas = mUserOp.callGasLimit + mUserOp.verificationGasLimit * mul + mUserOp.preVerificationGas;

            requiredPrefund = requiredGas * mUserOp.maxFeePerGas;
        }
        }
        */
        // userOp.maxFeePerGas, userOp.preVerificationGas, userOp.verificationGasLimit must > 0
        const ZERO = BigInt(0);
        const maxFeePerGas = BigInt(userOp.maxFeePerGas);
        const preVerificationGas = BigInt(userOp.preVerificationGas);
        const verificationGasLimit = BigInt(userOp.verificationGasLimit);
        const callGasLimit = BigInt(userOp.callGasLimit);
        if (maxFeePerGas === ZERO || preVerificationGas === ZERO || verificationGasLimit === ZERO) {
            throw new Error("maxFeePerGas, preVerificationGas, verificationGasLimit must > 0");
        }

        // uint256 mul = mUserOp.paymaster != address(0) ? 3 : 1;
        const mul = userOp.paymasterAndData !== '0x' ? 3 : 1;
        // uint256 requiredGas = mUserOp.callGasLimit + mUserOp.verificationGasLimit * mul + mUserOp.preVerificationGas;
        const requiredGas = callGasLimit + verificationGasLimit * BigInt(mul) + preVerificationGas;
        // requiredPrefund = requiredGas * mUserOp.maxFeePerGas;
        const requiredPrefund = requiredGas * maxFeePerGas;

        //return '0x' + requiredPrefund.toString(16);

        const _onChainConfig = await this.getOnChainConfig();

        const _entrypoint = new ethers.Contract(_onChainConfig.entryPoint, ABI_EntryPoint, this.provider);

        // balanceOf(): uint256 
        const _deposit: bigint = await _entrypoint.getFunction("balanceOf").staticCall(userOp.sender);

        const _missfund = _deposit < requiredPrefund ? requiredPrefund - _deposit : ZERO;

        return {
            deposit: '0x' + _deposit.toString(16),
            prefund: '0x' + requiredPrefund.toString(16),
            missfund: '0x' + _missfund.toString(16)
        };
    }

    async createUnsignedDeployWalletUserOp(
        index: number,
        initialKey: string,
        initialGuardianHash: string,
        callData: string = "0x",
        initialGuardianSafePeriod?: number
    ): Promise<UserOperation> {
        TypeGuard.onlyBytes(callData);
        const _initializeData = await this.initializeData(initialKey, initialGuardianHash, initialGuardianSafePeriod);
        const initCode = `${this.soulWalletFactoryAddress}${new ethers.Interface(ABI_SoulWalletFactory)
            .encodeFunctionData("createWallet", [_initializeData, Hex.paddingZero(index, 32)])
            .substring(2)
            }`.toLowerCase();
        const _userOperation: UserOperation = {
            /* 
             sender: PromiseOrValue<string>;
                nonce: PromiseOrValue<BigNumberish>;
                initCode: PromiseOrValue<BytesLike>;
                callData: PromiseOrValue<BytesLike>;
                callGasLimit: PromiseOrValue<BigNumberish>;
                verificationGasLimit: PromiseOrValue<BigNumberish>;
                preVerificationGas: PromiseOrValue<BigNumberish>;
                maxFeePerGas: PromiseOrValue<BigNumberish>;
                maxPriorityFeePerGas: PromiseOrValue<BigNumberish>;
                paymasterAndData: PromiseOrValue<BytesLike>;
                signature: PromiseOrValue<BytesLike>;
            */
            sender: await this.calcWalletAddress(index, initialKey, initialGuardianHash, initialGuardianSafePeriod),
            nonce: 0,
            /* 
             address factory = address(bytes20(initCode[0 : 20]));
             bytes memory initCallData = initCode[20 :];
             call(gas(), factory, 0, add(initCallData, 0x20), mload(initCallData), 0, 32)
              function createWallet(bytes memory _initializer, bytes32 _salt)
            */
            initCode,
            callData,
            callGasLimit: 0,
            verificationGasLimit: 0,
            preVerificationGas: this.preVerificationGasDeploy,
            maxFeePerGas: 0,
            maxPriorityFeePerGas: 0,
            paymasterAndData: "0x",
            signature: "0x"

        };


        return _userOperation;
    }

    async userOpHash(userOp: UserOperation): Promise<string> {
        const _onChainConfig = await this.getOnChainConfig();
        return getUserOpHash(userOp, _onChainConfig.entryPoint, _onChainConfig.chainId);
    }

    async packUserOpHash(userOp: UserOperation, validAfter?: number, validUntil?: number): Promise<{
        packedUserOpHash: string,
        validationData: string
    }> {
        const userOPHash = await this.userOpHash(userOp);
        return Signature.packUserOpHash(userOPHash, validAfter, validUntil);
    }

    private async guardHookList(walletAddress: string): Promise<string[]> {
        const _soulWallet = new ethers.Contract(walletAddress, ABI_SoulWallet, this.provider);
        // function listPlugin(uint8 hookType) external view returns (address[] memory plugins);
        const _guardHookList = await _soulWallet.listPlugin(1 /* uint8 private constant _GUARD_HOOK = 1 << 0; */);
        return _guardHookList;
    }

    async packUserOpSignature(signature: string, validationData: string, guardHookInputData?: GuardHookInputData): Promise<string> {
        let hookInputData: HookInputData | undefined = undefined;
        if (guardHookInputData !== undefined) {
            TypeGuard.onlyAddress(guardHookInputData.sender);
            hookInputData = new HookInputData();
            hookInputData.guardHooks = await this.guardHookList(guardHookInputData.sender);
            hookInputData.inputData = guardHookInputData.inputData;
        }
        return Signature.packSignature(signature, validationData, hookInputData);
    }

    async estimateUserOperationGas(userOp: UserOperation): Promise<UserOpErrors | undefined> {
        const semiValidSignature = userOp.signature === "0x";
        try {
            const _onChainConfig = await this.getOnChainConfig();
            if (semiValidSignature) {
                if (userOp.initCode !== "0x") {
                    // deploy
                    // no need guardHook input data 
                    userOp.signature = Signature.semiValidSignature();
                } else {
                    throw new Error("not implement now!");
                }
            }

            const userOpGasRet = await this.Bundler.eth_estimateUserOperationGas(_onChainConfig.entryPoint, userOp);
            if (!userOpGasRet.succ) {
                return userOpGasRet.errors!;
            }
            userOp.preVerificationGas = userOpGasRet.result!.preVerificationGas;
            userOp.verificationGasLimit = userOpGasRet.result!.verificationGasLimit;
            userOp.callGasLimit = userOpGasRet.result!.callGasLimit;
            GasOverhead.calcGasOverhead(userOp);
        } catch (error: any) {
            console.error(error);
            let errmsg: string = '';
            if (error.message) {
                errmsg = error.message;
            } else if (typeof error === 'string') {
                errmsg = error;
            } else if (typeof error === 'object') {
                errmsg = JSON.stringify(error);
            } else {
                errmsg = 'unknown error';
            }
            return new UserOpErrors(UserOpErrorCodes.UnknownError, errmsg);
        } finally {
            if (semiValidSignature) {
                userOp.signature = "0x";
            }
        }
    }

    async sendUserOperation(userOp: UserOperation): Promise<UserOpErrors | undefined> {
        try {
            const _onChainConfig = await this.getOnChainConfig();
            const sendUserOpRet = await this.Bundler.eth_sendUserOperation(_onChainConfig.entryPoint, userOp);
            if (!sendUserOpRet.succ) {
                return sendUserOpRet.errors!;
            }
            const userOPHashLocal = await this.userOpHash(userOp);
            if (sendUserOpRet.result!.toLowerCase() !== userOPHashLocal.toLowerCase()) {
                throw new Error("userOpHash !== userOPHashLocal");
            }
            return undefined;
        } catch (error: any) {
            console.error(error);

            let errmsg: string = '';
            if (error.message) {
                errmsg = error.message;
            } else if (typeof error === 'string') {
                errmsg = error;
            } else if (typeof error === 'object') {
                errmsg = JSON.stringify(error);
            } else {
                errmsg = 'unknown error';
            }
            return new UserOpErrors(UserOpErrorCodes.UnknownError, errmsg);
        }

    }
}