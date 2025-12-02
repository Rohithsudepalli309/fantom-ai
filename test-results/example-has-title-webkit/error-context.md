# Page snapshot

```yaml
- generic [ref=e7]:
  - generic [ref=e8]:
    - img "FANTOM AI" [ref=e9]:
      - img "FANTOM AI" [ref=e10]
    - heading "FANTOM AI" [level=1] [ref=e11]
  - generic [ref=e12]:
    - button "Login" [ref=e13] [cursor=pointer]
    - button "Sign up" [ref=e14] [cursor=pointer]
  - generic [ref=e15]:
    - generic [ref=e17]:
      - text: Email
      - textbox "Email" [ref=e18]:
        - /placeholder: you@example.com
    - generic [ref=e19]:
      - text: Password
      - generic [ref=e20]:
        - textbox "Password" [ref=e21]:
          - /placeholder: At least 8 characters
        - button "Show password" [ref=e22] [cursor=pointer]:
          - img "Show password" [ref=e23]
      - generic [ref=e26]: Use 8+ chars with a mix of letters, numbers, and symbols.
      - generic [ref=e30]: "Strength: —"
    - button "Login" [disabled] [ref=e31]
    - paragraph [ref=e32]: By continuing you agree to our Terms & Privacy.
```