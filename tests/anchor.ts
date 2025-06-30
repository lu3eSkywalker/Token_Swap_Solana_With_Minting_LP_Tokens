import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { SimpleTokenSwap } from "../target/types/Simple_Token_Swap";
import { BN } from "bn.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { assert } from "chai";

const base58PrivateKey = "5NBCZL6jHfFTvYkEyYz8rodWeaxWQgRgdRjmUs3Tc2uf2v4fMUqmDAHJbkuK1zbg9KhSyxhcBk1RFu7DN9vBKW62";
const privateKeySeed = bs58.decode(base58PrivateKey);

const userKeyPair = web3.Keypair.fromSecretKey(privateKeySeed);

const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const userWallet = new anchor.Wallet(userKeyPair);
const provider = new anchor.AnchorProvider(connection, userWallet, {
  preflightCommitment: "confirmed",
});
anchor.setProvider(provider);

describe("Test", () => {
  // Configure the client to use the local cluster

  const program = anchor.workspace.SimpleTokenSwap as anchor.Program<SimpleTokenSwap>;

  const tokenA_mint_address = new web3.PublicKey("6brEek47QhmqAxAuqBBnRMjshVM4XphbxFLjdVNE3uiM");
  const tokenB_mint_address = new web3.PublicKey("3vwLsA3XrM6Kqg1v6ACF4qYoZUQTM54i1atCFTPEKZG5");

  const userPublicKey = new web3.PublicKey("7eacdg5tZYPPqNdhi9PHvP5TUCEt9RjgUyoJL1a6L8JA");

  const [userPDALiquidity, bump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("liquidityPDA"), userPublicKey.toBuffer()],
    program.programId
  );

  const [vault_token_account_a, bump1] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
    program.programId
  );

  const [vault_token_account_b, bump2] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
    program.programId
  );

  const [vault_auth_a, bump3] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
    program.programId
  );

  const [vault_auth_b, bump4] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
    program.programId
  );

  it("initializes a Vault Account For Token A", async () => {
    const [vault_token_account, bump1] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
      program.programId
    );

    const [vaultPDA, bump2] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
      program.programId
    );

    // Send Transaction
    const txHash = await program.methods
      .initializeVaultTokenA()
      .accounts({
        vaultTokenAccount: vault_token_account,
        vault_auth: vaultPDA,
        payer: program.provider.publicKey,
        mint: tokenA_mint_address,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("initializes a Vault Account For Token B", async () => {
    const [vault_token_account, bump1] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
      program.programId
    )

    const [vaultPDA, bump2] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
      program.programId
    );

    // Send Transaction
    const txHash = await program.methods
      .initializeVaultTokenB()
      .accounts({
        vaultTokenAccount: vault_token_account,
        vault_auth: vaultPDA,
        payer: program.provider.publicKey,
        mint: tokenB_mint_address,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);

    const pda_token_value = await getAccount(program.provider.connection, vault_token_account);
    console.log("Vault Token B Account Balance: ", pda_token_value.amount.toString());
  });

  it("initializes a liquidity account", async () => {

    const [userPDALiquidity, bump] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("liquidityPDA"), userPublicKey.toBuffer()],
      program.programId
    );

    const accountInfo = await program.provider.connection.getAccountInfo(userPDALiquidity);

    if (accountInfo) {
      console.log("User Liquidity account is already initialized");
      return;
    }

    const txHash = await program.methods
      .initializeUserLiquidityAccount()
      .accounts({
        user: userPublicKey,
        userPdaAccount: userPDALiquidity,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("adds liquidity to the liquidity pool", async () => {

    // Deriving user Token ATA
    const user_token_a_ata = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const user_token_b_ata = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    const token_amount = new BN(5_000_000_000);

    const txHash = await program.methods
      .addLiquidity(token_amount)
      .accounts({
        user: userPublicKey,
        userPdaAccount: userPDALiquidity,
        userTokenAccountForTokenA: user_token_a_ata,
        userTokenAccountForTokenB: user_token_b_ata,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);

    const userLiquidityInfo = await program.account.liquidityAccount.fetch(userPDALiquidity);
    console.log("This is the userLiquidity info:  ", userLiquidityInfo.stakedTokenAmount.toNumber());

    // Assertions
    assert.equal(userLiquidityInfo.stakedTokenAmount.toNumber(), 5000000000);
  });

  it("removes liquidity from the liquidity pool", async () => {

    const user_token_a_ata = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const user_token_b_ata = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    const token_amount = new BN(5_000_000_000);

    const txHash = await program.methods
      .removeLiquidity(token_amount)
      .accounts({
        user: userPublicKey,
        userPdaAccount: userPDALiquidity,
        userTokenAccountForTokenA: user_token_a_ata,
        userTokenAccountForTokenB: user_token_b_ata,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);

    const userLiquidityInfo = await program.account.liquidityAccount.fetch(userPDALiquidity);
    console.log("This is the userLiquidityInfo is: ", userLiquidityInfo.stakedTokenAmount.toNumber());

    // Assertions
    assert.equal(userLiquidityInfo.stakedTokenAmount.toNumber(), 0);
  })

  it("Swap Token A for Token B for a user", async () => {
    const userPublicKey = new web3.PublicKey("7eacdg5tZYPPqNdhi9PHvP5TUCEt9RjgUyoJL1a6L8JA");

    // Deriving user ATA for Token A
    const destination_token_a = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const userATAforTokenA = destination_token_a.toBase58();

    // Deriving user ATA for Token B
    const destination = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    // Check if the Token_B ATA is initialized or not
    const ataAccountInfo = await program.provider.connection.getAccountInfo(destination);

    if (ataAccountInfo && ataAccountInfo.data.length > 0) {
      console.log("ATA is already initialized");
    } else {
      console.log("Initializing ATA");

      // Create associated token account if it doesn't exist
      const ataIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,     // payer
        destination,               // ata to be created
        userPublicKey,                  // token account owner
        tokenB_mint_address             // mint
      );

      const tx = new web3.Transaction().add(ataIx);

      await program.provider.sendAndConfirm(tx);
    }

    const userATAforTokenB = destination.toBase58();

    const vaultTokenAVault = await getAccount(program.provider.connection, vault_token_account_a);
    const vaultTokenBVault = await getAccount(program.provider.connection, vault_token_account_b);

    console.log("This is the value of vault_token_account_a: ", vaultTokenAVault.amount.toString());
    console.log("This is the value of vault_token_account_b: ", vaultTokenBVault.amount.toString());

    const amount = new BN(1_000_000_000);

    const txHash = await program.methods
      .swapAForB(amount)
      .accounts({
        user: userPublicKey,
        userTokenAccountForTokenA: userATAforTokenA,
        userTokenAccountForTokenB: userATAforTokenB,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("Swap Token B for Token A for a user", async () => {
    const userPublicKey = new web3.PublicKey("7eacdg5tZYPPqNdhi9PHvP5TUCEt9RjgUyoJL1a6L8JA");

    // Deriving user ATA for Token B
    const destination = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    const userATAforTokenB = destination.toBase58();

    // Deriving user ATA for Token A
    const destination_token_a = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const userATAforTokenA = destination_token_a.toBase58();

    // Check if the Token_A ATA is initialized or not
    const ataAccountInfo = await program.provider.connection.getAccountInfo(destination_token_a);

    if (ataAccountInfo && ataAccountInfo.data.length > 0) {
      console.log("ATA is already initialized");
    } else {
      console.log("Initializing ATA");

      // Create associated token account if it doesn't exist
      const ataIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,     // payer
        destination_token_a,            // ata to be created
        userPublicKey,                  // token account owner
        tokenA_mint_address             // mint
      );

      const tx = new web3.Transaction().add(ataIx);

      await program.provider.sendAndConfirm(tx);
    }

    const vaultTokenAVault = await getAccount(program.provider.connection, vault_token_account_a);
    const vaultTokenBVault = await getAccount(program.provider.connection, vault_token_account_b);

    const amount = new BN(1_000_000_000);

    const txHash = await program.methods
      .swapBForA(amount)
      .accounts({
        user: userPublicKey,
        userTokenAccountForTokenA: userATAforTokenA,
        userTokenAccountForTokenB: userATAforTokenB,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });
});