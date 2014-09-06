from datetime import datetime
import re

from flask import Flask, Response, abort, stream_with_context, render_template

from wake import base


app = Flask(__name__, static_folder='../build/static')


def entity_whitespace(html):
    def entity(match):
        return '&#' + str(ord(match.group())) + ';'
    return '<pre>' + re.sub('\s', entity, html) + '</pre>'


@app.after_request
def after(response):
    if response.mimetype != 'text/html':
        return response

    # minify html
    data = response.response
    def stream_minified():
        for html in data:
            html = re.sub(
                r"<pre>(.*?)</pre>",
                lambda m: entity_whitespace(m.group(1)),
                html,
                flags=re.DOTALL,
            )
            html = re.sub(r"\s+", " ", html)
            html = re.sub(r">\s*<", "><", html)
            yield html

    response.headers.pop('Content-Length', None)
    response.response = stream_minified()

    return response


with app.open_resource('../build/static/main.css') as f:
    css = f.read()


with app.open_resource('../build/static/main.js') as f:
    js = f.read()


@app.template_filter('date')
def date(timestamp):
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime('%B %e, %Y')


@app.template_filter('dashify')
def dashify(text):
    return text.replace(' -- ', ' &ndash; ')


def stream_page(render, body_class=None, title=None):
    @stream_with_context
    def stream():
        yield render_template('start.html',
                css=css, js=js, body_class=body_class, title=title)
        yield render()
        yield render_template('end.html')
    return Response(stream())


@app.route('/')
def index():
    def render():
        return render_template('stream.html',
            events=base.store.collapsed_events(
                source='git-markdown:/home/chromakode/blog:post',
            ),
        )
    return stream_page(render, body_class='front')


@app.route('/post/<slug>')
def by_slug(slug):
    events = list(base.store.events_by_slug(slug))
    if not events:
        abort(404)

    def render():
        return render_template('stream.html', events=events)
    return stream_page(render, title=events[0]['title'])


app.register_blueprint(base.blueprint)
