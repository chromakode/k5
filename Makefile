# For your convenience, the following Debian packages are required:
# node-less node-uglify

SRC_DIR=k5
BUILD_DIR=build

all: $(BUILD_DIR) $(BUILD_DIR)/static $(BUILD_DIR)/static/main.css $(BUILD_DIR)/static/main.js

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

.PHONY: $(BUILD_DIR)/static
$(BUILD_DIR)/static:
	cp -ruTL $(SRC_DIR)/static/public $@

$(BUILD_DIR)/static/main.css: $(SRC_DIR)/static/main.less
	lessc -x $< > $@

$(BUILD_DIR)/static/main.js: $(SRC_DIR)/static/lib/seen.js $(SRC_DIR)/static/main.js
	cat $^ | uglifyjs --inline-script > $@

clean:
	rm -rf $(BUILD_DIR)
