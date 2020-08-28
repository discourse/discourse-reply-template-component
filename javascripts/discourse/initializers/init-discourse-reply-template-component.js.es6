import { ajax } from "discourse/lib/ajax";
import { getOwner } from "discourse-common/lib/get-owner";
import { withPluginApi } from "discourse/lib/plugin-api";
import Composer from "discourse/models/composer";

function buildButton(dataset, extraClass) {
  const action = dataset.action || "reply";
  const label = dataset.label;

  const button = document.createElement("button");
  button.classList.add("add-template", "btn", "btn-default", "btn-primary");

  if (extraClass) {
    button.classList.add(extraClass);
  }

  button.innerText =
    label ||
    I18n.t(
      themePrefix(`discourse_reply_template_component.use_template_${action}`)
    );

  return button;
}

function openComposerWithTemplateAndAction(controller, post, dataset) {
  return ajax(`/posts/${post.id}`, {
    cache: false
  }).then(data => {
    const regex = new RegExp(
      '\\[wrap=template.*?\\skey="' +
        dataset.key +
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

      const controllerOptions = {
        topicBody: match[1],
        draftKey: controller.topicModel.draft_key,
        draftSequence: controller.topicModel.draftSequence,
        skipDraftCheck: true,
        categoryId: dataset.categoryId || null
      };

      if (dataset.action && dataset.action === "create") {
        controller.open(
          Object.assign(
            {
              action: Composer.CREATE_TOPIC
            },
            controllerOptions
          )
        );
      } else {
        controller.open(
          Object.assign(
            {
              action: Composer.REPLY,
              topic: post.topic
            },
            controllerOptions
          )
        );
      }
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

              if ((wrap.innerText.match(/\n/g) || []).length >= 20) {
                const topButton = buildButton(wrap.dataset, "top");
                topButton.addEventListener(
                  "click",
                  openComposerWithTemplateAndAction.bind(
                    null,
                    controller,
                    post,
                    wrap.dataset
                  )
                );
                wrap.prepend(topButton);
              }

              const bottomButton = buildButton(wrap.dataset, "bottom");
              bottomButton.addEventListener(
                "click",
                openComposerWithTemplateAndAction.bind(
                  null,
                  controller,
                  post,
                  wrap.dataset
                )
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
