# @hierarchidb/ui-build-progress

Last updated: 2026-04-05

Build progress display UI components for HierarchiDB. Provides per-stage progress bars, task lists, and error display.

## Menu focus

Build progress menus are opened from visible toolbar or stage buttons. They must restore focus to the trigger when closed, so `DialogSafeMenu` usages in this package explicitly set `disableRestoreFocus={false}`.

## License

MIT
