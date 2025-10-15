# AngularBroadcastChannel

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.0.0.

| Action                   | Effect                                        |
| ------------------------ | --------------------------------------------- |
| User logs in on Tab A    | Broadcasts `user:login`                       |
| Tab B receives login     | Updates its `localStorage` + redirects to `/` |
| User logs out on any tab | Broadcasts `user:logout`                      |
| All tabs                 | Clear JWT + redirect to `/login`              |
| SSR rendering            | No `window`/`BroadcastChannel` errors         |
