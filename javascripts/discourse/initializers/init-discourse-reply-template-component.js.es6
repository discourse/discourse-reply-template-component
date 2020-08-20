import { ajax } from "discourse/lib/ajax";
import { getOwner } from "discourse-common/lib/get-owner";
import { withPluginApi } from "discourse/lib/plugin-api";
import Composer from "discourse/models/composer";

function buildButton(label, extraClass) {
  const button = document.createElement("button");
  button.classList.add("add-template", "btn", "btn-default", "btn-primary");

  if (extraClass) {
    button.classList.add(extraClass);
  }

  button.innerText =
    label ||
    I18n.t(themePrefix("discourse_reply_template_component.use_template"));

  return button;
}

function openComposerWithTemplate(controller, post, key) {
  return ajax(`/posts/${post.id}`, {
    cache: false
  }).then(data => {
    const regex = new RegExp(
      '\\[wrap=template.*?\\skey="' +
        key +
        '".*?\\]\\n((?:.|\n)*?)\\n\\[\\/wrap\\]',
      "gm"
    );
    const match = regex.exec(data.raw || "");

    const replacers = [
      {
        regex: /(\$week_start)/g,
        fn: () =>
          moment()
            .startOf("isoWeek")
            .format("LL")
      },
      {
        regex: /(\$week_end)/g,
        fn: () =>
          moment()
            .endOf("isoWeek")
            .format("LL")
      },
      {
        regex: /(\$prev_week_start)/g,
        fn: () =>
          moment()
            .subtract(1, "week")
            .startOf("isoWeek")
            .format("LL")
      },
      {
        regex: /(\$prev_week_end)/g,
        fn: () =>
          moment()
            .subtract(1, "week")
            .endOf("isoWeek")
            .format("LL")
      }
    ];

    if (match && match[1]) {
      replacers.forEach(replacer => {
        match[1] = match[1].replace(replacer.regex, replacer.fn);
      });

      controller.open({
        action: Composer.REPLY,
        topicBody: match[1],
        draftKey: controller.topicModel.draft_key,
        draftSequence: controller.topicModel.draftSequence,
        topic: post.topic,
        skipDraftCheck: true
      });
    }
  });
}

export default {
  name: "discourse-reply-template-component-setup",

  initialize() {
    withPluginApi("0.8", api => {
      api.decorateCookedElement(
        (cooked, helper) => {
          const wraps = cooked.querySelectorAll(
            'div.d-wrap[data-wrap="template"]'
          );

          if (wraps) {
            const post = helper.getModel();

            if (!post) return;

            const controller = getOwner(this).lookup("controller:composer");

            wraps.forEach(wrap => {
              const key = wrap.dataset.key;
              if (!key) {
                bootbox.alert(
                  I18n.t(
                    themePrefix("discourse_reply_template_component.needs_key")
                  )
                );
              }

              const label = wrap.dataset.label;

              if ((wrap.innerText.match(/\n/g) || []).length >= 20) {
                const topButton = buildButton(label, "top");
                topButton.addEventListener(
                  "click",
                  openComposerWithTemplate.bind(null, controller, post, key)
                );
                wrap.prepend(topButton);
              }

              const bottomButton = buildButton(label, "bottom");
              bottomButton.addEventListener(
                "click",
                openComposerWithTemplate.bind(null, controller, post, key)
              );
              wrap.appendChild(bottomButton);
            });
          }
        },
        { onlyStream: true, id: "discourse-reply-template-component" }
      );
    });
  }
};
