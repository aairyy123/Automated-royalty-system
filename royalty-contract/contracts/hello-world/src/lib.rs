#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String, Symbol, Map,
};

use soroban_sdk::token::Client as TokenClient;

#[contract]
pub struct RoyaltyContract;

/* ---------------- DATA TYPES ---------------- */

#[contracttype]
#[derive(Clone)]
pub struct Content {
    pub cid: String,
    pub content_type: Symbol,
    pub creator: Address,
    pub royalty_percent: u32,
    pub total_earned: i128,
}

#[contracttype]
pub enum DataKey {
    Contents,
}

/* ---------------- HELPERS ---------------- */

fn contents(env: &Env) -> Map<String, Content> {
    env.storage()
        .instance()
        .get(&DataKey::Contents)
        .unwrap_or(Map::new(env))
}

/* ---------------- CONTRACT ---------------- */

#[contractimpl]
impl RoyaltyContract {

    pub fn init(env: Env) {
        if env.storage().instance().has(&DataKey::Contents) {
            return;
        }
        env.storage()
            .instance()
            .set(&DataKey::Contents, &Map::<String, Content>::new(&env));
    }

    /* -------- REGISTER CONTENT -------- */
    pub fn register_content(
        env: Env,
        cid: String,
        creator: Address,
        royalty_percent: u32,
        content_type: Symbol,
    ) {
        creator.require_auth();

        let mut map = contents(&env);

        if map.contains_key(cid.clone()) {
            panic!("Already registered");
        }

        map.set(
            cid.clone(),
            Content {
                cid,
                content_type,
                creator,
                royalty_percent,
                total_earned: 0,
            },
        );

        env.storage().instance().set(&DataKey::Contents, &map);
    }

    /* -------- GET CONTENT -------- */
    pub fn get_content(env: Env, cid: String) -> Content {
        contents(&env).get(cid).unwrap()
    }

    /* -------- PAY ON VIEW (NATIVE XLM) -------- */
    pub fn pay_on_view(
        env: Env,
        cid: String,
        token_address: Address, // 👈 native XLM passed in
        payer: Address,
        amount: i128,
    ) {
        payer.require_auth();

        let mut map = contents(&env);
        let mut content = map.get(cid.clone()).unwrap();

        let royalty = amount * content.royalty_percent as i128 / 100;

        let token = TokenClient::new(&env, &token_address);

        token.transfer(
            &payer,
            &env.current_contract_address(),
            &amount,
        );

        content.total_earned += royalty;

        map.set(cid, content);
        env.storage().instance().set(&DataKey::Contents, &map);
    }

    /* -------- WITHDRAW -------- */
    pub fn withdraw(
        env: Env,
        cid: String,
        token_address: Address, // 👈 native XLM
        creator: Address,
    ) {
        creator.require_auth();

        let mut map = contents(&env);
        let mut content = map.get(cid.clone()).unwrap();

        if content.creator != creator {
            panic!("Only creator");
        }

        let amount = content.total_earned;
        if amount <= 0 {
            panic!("Nothing to withdraw");
        }

        content.total_earned = 0;
        map.set(cid, content);
        env.storage().instance().set(&DataKey::Contents, &map);

        let token = TokenClient::new(&env, &token_address);

        token.transfer(
            &env.current_contract_address(),
            &creator,
            &amount,
        );
    }
}
