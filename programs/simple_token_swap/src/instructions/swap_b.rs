use crate::contexts::TokenSwap;
use crate::errors::errors::TokenSwapError;
use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, InitializeAccount, Mint, Token, TokenAccount, TokenAccount as SPLTokenAccount, Transfer,
};
use crate::utils::amm::amm_calculation;
use crate::utils::transfer::deposit_to_vault_token_b;
use crate::utils::transfer::send_token_a_from_token_vault_to_user;
use crate::utils::transfer::send_token_b_from_token_vault_to_user;

pub fn swap_b_for_a(ctx: Context<TokenSwap>, amountOfTokenB: u64) -> Result<()> {
    let token_a_quantity = ctx.accounts.vault_token_a_account.amount;
    let token_b_quantity = ctx.accounts.vault_token_b_account.amount;

    let (x) = amm_calculation(token_a_quantity, token_b_quantity)?;

    let tokenAToSend = (x / ((token_b_quantity as u128) + (amountOfTokenB as u128)))
        .try_into()
        .map_err(|_| error!(TokenSwapError::CalculationError))?;

    let tokenAtoGive = (token_a_quantity as u128)
        .checked_sub(tokenAToSend)
        .ok_or(error!(TokenSwapError::CalculationError))?;

    require!(
        tokenAtoGive <= token_a_quantity as u128,
        TokenSwapError::InsufficientTokenA
    );

    // Transfer Token B from user to Token Vault
    deposit_to_vault_token_b(
        &ctx.accounts.user.to_account_info(),
        &ctx.accounts.user_token_account_for_token_b,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.token_program,
        amountOfTokenB,
    )?;

    // Convert to u64 before transferring
    let tokenAtoGive: u64 = tokenAtoGive
        .try_into()
        .map_err(|_| error!(TokenSwapError::CalculationError))?;

    // Transfer Token A from Token Vault to user
    send_token_a_from_token_vault_to_user(
        &ctx.accounts.mint_a,
        &ctx.accounts.vault_auth_a,
        &ctx.accounts.vault_token_a_account,
        &ctx.accounts.user_token_account_for_token_a,
        &ctx.accounts.token_program,
        ctx.bumps.vault_auth_a,
        tokenAtoGive,
    )?;

    Ok(())
}
