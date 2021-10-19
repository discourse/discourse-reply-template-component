import showModal from "discourse/lib/show-modal";
import { escape } from "pretty-text/sanitizer";
import { htmlSafe } from "@ember/template";
import { emojiUnescape } from "discourse/lib/text";
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
    checkboxDescription.innerHTML = htmlSafe(emojiUnescape(escape(tag)));

    const checkboxWrapper = document.createElement("div");
    checkboxWrapper.classList.add("checkbox-wrapper");
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxDescription);

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
  Object.entries(options).forEach(([key, value]) => {
    parts.push(`${key}=${value}`);
  });

  return `[${parts.join(" ")}]`;
}

function _create(dataset, post, controllerOptions) {
  return Object.assign(controllerOptions, {
    action: Composer.CREATE_TOPIC
  });
}

function _createPm(dataset, post, controllerOptions) {
  return Object.assign(controllerOptions, {
    action: Composer.PRIVATE_MESSAGE,
    topic: post.topic
  });
}

function _reply(dataset, post, controllerOptions) {
  return Object.assign(controllerOptions, {
    action: Composer.REPLY,
    topic: post.topic
  });
}

function _buildDraftKey(topicId, action) {
  if (!action || action === "reply") {
    return `topic_${topicId}`;
  }

  return "new_topic";
}

function openComposerWithTemplateAndAction(controller, post, wrap) {
  const currentUser = getOwner(this).lookup("current-user:main");
  if (!currentUser) {
    showModal("login");
    return;
  }

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

      let topicBody = match[1];

      const checkboxes = wrap.querySelectorAll("input[type=checkbox]:checked");
      if (checkboxes.length) {
        const tags = Array.from(checkboxes).mapBy("value");
        topicBody += `\n\n${tags.join(", ")}`;
      }

      let controllerOptions = {
        topicBody,
        draftKey:
          controller.topicModel?.draft_key ||
          _buildDraftKey(post.topic_id, dataset.action),
        draftSequence: controller.topicModel?.draftSequence,
        skipDraftCheck: true,
        categoryId: dataset.categoryId || null
      };

      switch (dataset.action) {
        case "create":
          controllerOptions = _create(dataset, post, controllerOptions);
          break;
        case "create_pm":
          controllerOptions = _createPm(dataset, post, controllerOptions);
          break;
        case "reply":
        case null:
        case undefined:
          controllerOptions = _reply(dataset, post, controllerOptions);
          break;
      }

      controller.open(controllerOptions);
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
