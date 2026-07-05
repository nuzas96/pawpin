// Empty stub aliased to the `server-only` package in vitest (see
// vitest.config.ts). In the real app, importing `server-only` in a module
// that ends up in a client bundle fails the build — the guarantee we want in
// production. Under vitest (a Node environment) there is no bundler export
// condition to resolve it, so we alias it to this no-op so server-only
// modules (rate limiter, AI vision, storage helpers) can be unit-tested.
export {};
