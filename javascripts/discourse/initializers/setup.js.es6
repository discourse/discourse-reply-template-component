import { ajax } from "discourse/lib/ajax";
import { getOwner } from "discourse-common/lib/get-owner";
import { withPluginApi } from "discourse/lib/plugin-api";
import Composer from "discourse/models/composer";

export default {
  name: "discourse-reply-template-component-setup",

  initialize() {
    withPluginApi("0.8", api => {
      api.decorateCooked(
        ($post, helper) => {
          const wraps = $post[0].querySelectorAll(
            'div.d-wrap[data-wrap="template"]'
          );

          if (wraps) {
            wraps.forEach(wrap => {
              const button = document.createElement("button");
              button.classList.add("add-template");
              button.classList.add("btn");
              button.classList.add("btn-default");
              button.classList.add("btn-primary");
              button.innerText = wrap.getAttribute("data-label") || I18n.t(
                themePrefix("discourse_reply_template_component.use_template")
              );

              $(button).on("click", () => {
                const post = helper.getModel();

                return ajax(`/posts/${post.id}`, {
                  cache: false
                }).then(data => {
                  const controller = getOwner(this).lookup(
                    "controller:composer"
                  );

                  const key = wrap.getAttribute("data-key");
                  const regex = new RegExp(
                    '\\[wrap=template\\skey="' +
                      key +
                      '"\\]\\n((?:.|\n)*?)\\n\\[\\/wrap\\]',
                    "gm"
                  );
                  const match = regex.exec(data.raw || "");
                  if (match && match[1]) {
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
              });

              wrap.appendChild(button);
            });
          }
        },
        { onlyStream: true, id: "discourse-reply-template-component" }
      );
    });
  }
};
