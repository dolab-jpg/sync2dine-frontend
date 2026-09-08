from pathlib import Path

p = Path(
    "/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/"
    "hello-elementor-child/sync2dine-dual-product.php"
)
t = p.read_text(encoding="utf-8")
if "undefined-3ec2799" in t:
    print("already ok")
else:
    t = t.replace(
        'body.home .elementor-element-3ec2799,\nbody.home [data-id="3ec2799"]',
        'body.home .elementor-element-undefined-3ec2799,\n'
        'body.home [data-id="undefined-3ec2799"],\n'
        "body.home .elementor-element-3ec2799",
    )
    if "undefined-3ec2799" not in t:
        t += (
            "\nadd_action('wp_head', function () {\n"
            "\tif (!is_front_page()) return;\n"
            "\techo '<style data-no-optimize=\"1\">"
            "body.home .elementor-element-undefined-3ec2799,"
            "body.home [data-id=\"undefined-3ec2799\"]{"
            "min-height:0!important;height:auto!important;"
            "align-self:start!important;background:transparent!important;"
            "}</style>';\n"
            "}, 99);\n"
        )
        print("appended wp_head")
    else:
        print("patched inline css")
    p.write_text(t, encoding="utf-8")
