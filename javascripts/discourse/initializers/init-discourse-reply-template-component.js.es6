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

function buildTagsList(tags) {
  const tagsList = document.createElement("div");
  tagsList.classList.add("tags-list");

  tags.forEach(tag => {
    const checkbox = document.createElement("input");
    checkbox.classList.add("checkbox");
    checkbox.value = tag;
    checkbox.type = "checkbox";

    const checkboxDescription = document.createElement("span");
    checkboxDescription.classList.add("checkbox-description");
    checkboxDescription.innerText = tag;

    const checkboxWrapper = document.createElement("div");
    checkboxWrapper.classList.add("checkbox-wrapper");
    checkboxWrapper.appendChild(checkboxDescription);
    checkboxWrapper.appendChild(checkbox);

    tagsList.appendChild(checkboxWrapper);
  });

  return tagsList;
}

function localDateFormat(date) {
  const options = {
    date: date.format("YYYY-MM-DD"),
    timezone: moment.tz.guess()
  };

  if (!date.startOf("day").isSame(date) && !date.endOf("day").isSame(date)) {
    options.time = date.format("HH:mm");
  }

  const parts = [];
  Object.keys(options).forEach(key => {
    const value = options[key];
    parts.push(`${key}=${value}`);
  });

  return `[${parts.join(" ")}]`;
}

function openComposerWithTemplateAndAction(controller, post, wrap) {
  const dataset = wrap.dataset;

  return ajax(`/posts/${post.id}`, {
    cache: false
  }).then(data => {
    const regex = new RegExp(
      '\\[wrap=template.*?\\skey="?' +
        dataset.key +
        '"?.*?\\]\\n((?:.|\n)*?)\\n\\[\\/wrap\\]',
      "gm"
    );
    const match = regex.exec(data.raw || "");

    const replacers = [
      {
        regex: /(\$tomorrow)/g,
        fn: () => {
          const date = moment()
            .add(1, "day")
            .startOf("day");
          return localDateFormat(date);
        }
      },
      {
        regex: /(\$week_start)/g,
        fn: () => {
          const date = moment().startOf("isoWeek");
          return localDateFormat(date);
        }
      },
      {
        regex: /(\$week_end)/g,
        fn: () => {
          const date = moment().endOf("isoWeek");
          return localDateFormat(date);
        }
      },
      {
        regex: /(\$prev_week_start)/g,
        fn: () => {
          const date = moment()
            .subtract(1, "week")
            .startOf("isoWeek");
          return localDateFormat(date);
        }
      },
      {
        regex: /(\$prev_week_end)/g,
        fn: () => {
          const date = moment()
            .subtract(1, "week")
            .endOf("isoWeek");
          return localDateFormat(date);
        }
      }
    ];

    if (match && match[1]) {
      replacers.forEach(replacer => {
        match[1] = match[1].replace(replacer.regex, replacer.fn);
      });

      const tags = wrap
        .querySelectorAll("input[type=checkbox]:checked")
        .values()
        .map((checkbox) => `#${checkbox.value}`);

      let topicBody = match[1];
      if (tags.length) {
        topicBody += `\n${tags.join(", ")}`;
      }

      const controllerOptions = {
        topicBody,
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

          if (helper && wraps) {
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
                    wrap
                  )
                );
                wrap.prepend(topButton);
              }

              if (wrap.dataset.tagsList && wrap.dataset.tagsList.length) {
                const tags = wrap.dataset.tagsList.split(",").filter(Boolean);
                wrap.appendChild(buildTagsList(tags));
              }

              const bottomButton = buildButton(wrap.dataset, "bottom");
              bottomButton.addEventListener(
                "click",
                openComposerWithTemplateAndAction.bind(
                  null,
                  controller,
                  post,
                  wrap
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
