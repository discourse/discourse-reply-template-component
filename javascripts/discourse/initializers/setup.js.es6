import { ajax } from "discourse/lib/ajax";
import { getOwner } from "discourse-common/lib/get-owner";
import { default as computed } from "ember-addons/ember-computed-decorators";
import { withPluginApi } from "discourse/lib/plugin-api";
import Composer from "discourse/models/composer";

export default {
  name: "discourse-reply-template-component-setup",

  initialize() {
    withPluginApi("0.8", api => {
      api.decorateCooked(
        ($post, helper) => {
          const wrap = $post[0].querySelector(
            'div.d-wrap[data-wrap="template"]'
          );

          if (wrap) {
            const button = document.createElement("button");
            button.classList.add("add-template");
            button.classList.add("btn");
            button.classList.add("btn-default");
            button.classList.add("btn-primary");
            button.innerText = I18n.t(
              themePrefix("discourse_reply_template_component.use_template")
            );

            document.addEventListener(
              "click",
              function(event) {
                if (!event.target.matches(".add-template")) return;
                event.preventDefault();

                const post = helper.getModel();

                return ajax(`/posts/${post.id}`, {
                  cache: false
                }).then(data => {
                  const controller = getOwner(this).lookup(
                    "controller:composer"
                  );

                  const regex = /\[wrap=template\]\n(.*)\n\[\/wrap\]/gms;
                  const match = regex.exec(data.raw || "");

                  if (match && match[1]) {
                    controller.open({
                      action: Composer.REPLY,
                      topicBody: match[1],
                      draftKey: post.topic.draft_key,
                      draftSequence: post.topic.draft_sequence,
                      topic: post.topic
                    });
                  }
                });
              },
              false
            );

            wrap.appendChild(button);
          }
        },
        { onlyStream: true, id: "discourse-reply-template-component" }
      );
    });
  }
};
