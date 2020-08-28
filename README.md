# discourse-repluy-template-component

## Usage

```
[wrap=template key="template-name"]
My reusable content

- [ ] task 1
- [ ] task 2
[/wrap]
```

**key is mandatory**

Other options:

- `action="create"` this will make the button open a composer to create a new topic, instead of replying
- `categoryId="2"` only usable with `action="create"`, will set the category of the opened composer

Placeholders:

You can have special keys in your template which will get replaced:

- \$week_start -> date at the beginning of the week
- \$week_end -> date at the end of the week
- \$prev_week_start -> date at the start of previous week
- \$prev_week_end -> date at the end of previous week
