# Privacy

- The verdict is computed on your device. Message text stays there.
- Checks are saved to a local history in this browser (IndexedDB) so the dashboard can show them. You can delete one check or clear all history in the dashboard. Nothing in it is sent anywhere.
- **Explain with AI** is off until you press it. It sends the message to the DealGuard proxy after removing, in the extension: emails (the domain stays), phone numbers, Aadhaar, PAN, card numbers, UPI IDs, link paths, @handles, and personal names (From and Reply-To display names, greeting names, the name after a sign-off, "I'm" and "My name is" introductions). Name removal is best effort and can miss names written in other ways, so read the message before you send it. The proxy removes the same items again before it calls the model.
- The proxy forwards that text to Anthropic's API to get an explanation. It stores nothing and logs only: timestamp, route, status, latency, hashed install id. It never logs message text, senders or links.
- The dashboard sign-in is a local gate compiled into the build. It is not a security boundary.
- No analytics, no telemetry, no third-party scripts, no remote fonts.
