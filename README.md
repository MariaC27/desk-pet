# Desk Pet

A little pixel-art plant that lives on your Mac desktop, grows with your GitHub
contributions each week, and carries messages from someone who cares.

See [PLAN.md](PLAN.md) for the full plan.

## Development

Requires Node 22+ and Rust (`rustup`).

```sh
cd app
npm install
npm start          # dev app (separate "Desk Pet Dev" identity, menu-bar only)
npm test           # growth/week-boundary tests
npm run sprites    # render every stage & mood to sprites.png for review
npm run icons      # regenerate tray + app icons from the sprite
npm run release    # build Desk Pet.app + .dmg
```

In dev, the menu-bar icon has a **Dev Panel** entry for jumping to any stage,
mood, or overlay without waiting for real activity.
