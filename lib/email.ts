import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'BizHaus <noreply@bizhaus.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const STAFF_EMAIL = process.env.STAFF_NOTIFICATION_EMAIL ?? 'hello@bizhaus.com'

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

function emailWrapper(content: string) {
  return `
    <div style="font-family:${FONT};background:#f1f5f9;padding:40px 16px;min-height:100vh;">
      <div style="max-width:520px;margin:0 auto;">
        <!-- Header -->
        <div style="background:#0f172a;border-radius:10px 10px 0 0;padding:24px 32px;">
          <span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px;">BizHaus</span>
          <span style="color:#94a3b8;font-size:13px;margin-left:10px;">Member Portal</span>
        </div>
        <!-- Body -->
        <div style="background:#ffffff;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;">
          ${content}
        </div>
        <!-- Footer -->
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          BizHaus · Member Portal
        </p>
      </div>
    </div>
  `
}

// Day pass / external booking emails use the site's real green branding
// (#6ec664, pulled from bizhaus.com's own CSS) instead of the member
// portal's dark/blue look — these go to non-members, who never see the
// member portal at all, so the blue "Member Portal" wrapper read as the
// wrong product.
const BOOKING_GREEN = '#6ec664'
const LOGO_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA1UAAABxCAYAAAA9Kol7AAABWGlDQ1BJQ0MgUHJvZmlsZQAAeJx9kLFLw1AQxr9WpaB1EB0cHDKJQ5SSCro4tBVEcQhVweqUvqapkMZHkiIFN/+Bgv+BCs5uFoc6OjgIopPo5uSk4KLleS+JpCJ6j+N+fO+74zggOW5wbvcDqDu+W1zKK5ulLSX1jAS9IAzm8Zyur0r+rj/j/T703k7LWb///43Biukxqp+UGcZdH0ioxPqezyXvE4+5tBRxS7IV8onkcsjngWe9WCC+JlZYzagQvxCr5R7d6uG63WDRDnL7tOlsrMk5lBNYxA48cNgw0IQCHdk//LOBv4BdcjfhUp+FGnzqyZEiJ5jEy3DAMAOVWEOGUpN3ju53F91PjbWDJ2ChI4S4iLWVDnA2Rydrx9rUPDAyBFy1ueEagdRHmaxWgddTYLgEjN5Qz7ZXzWrh9uk8MPAoxNskkDoEui0hPo6E6B5T8wNw6XwBA6diE8HYWhMAACDuSURBVHic7d0JmCRVlS/wc25kZlV12d3VRVbGjRRFEEVRHPQDRd8Mi6PDuIPiggsOoiAIKquI66DzXJCnIo/FhcFhaHB3FNxAxQUdRxAGHuMy444ZN7Kys7q66aWyMu953+0u+FrsjMjqyozI5f/7vqbpzpNxz1ddmZUn7r3nEgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACMkGKxGGSdAwBAr6mejwAAAAAjK5/PXx0EwWOzzgMAoJdyPb06AAAAjKxSqfQEJvo7EjmXiF6TdT4A0N9mZmYelVfqCFHqMBJ5FDPvKyJriWiSmRsiMk9EG5joHhK5oyny/Wq1+mMikqxz525fUGv9CEX0krgYS2RZZJGUWmBr50Wk3iIKm83m7+r1+qZu5wTp8H3/uR7zgW0DRDZUouhTqSY1gorF4upCLncqDYit27d/fOPGjRuzzmNYrFu3bu3E2NgpcTHC/NUwDH9OGZment57vFB4eVxMo9m8vFarbU4vK+iFIAiuZSL3b91oLC4+olarhVnnBMP/2i1rfToRrWr3uDB/JwzD29LNCtpZu3btusmJidcR0SuJ+SBavntJ5PpGs/nhWq1WoWGZqVLWPoo87wOxMe4/vFTPKbWjsnOJ5DzPvQHXWORuIbqDrP0hb9v2g8rmzbVu5wndp5Q6nnb+8NwtIXIf4lBU9Zi1doqYY1+D/UKIvrlx48YPZp3HMCkUCtNJ//5s7b208/WYiTHP2zcpR2vteiJCUTXgH8BZ5MVLP+8LuVzuzUT0lqzzgp6/dq/L+rUrRO9g5lJMyFlEhKIqY1NTU1OrxsffJkSnEvPkCi61NzGfU8jnT9daf2Lbtm3vmp+fn6NR31PFREViPoqZz2LP+6JMTkblILhVa33OzMyMzjo/AOgOEWmKiPvBBgBDaGxs7Gxizt//Z0V0iptJzzYrAOgHZd8/fmJi4r9dMcQrK6h2Na6Yz5hcterucqn0TBr1ourBmNnl+DTFfFHO8+4NguBLpVLpaVnnBQArI0SXG2P+K+s8AKA3y1BJ5KQ/+0vmtblc7uTMkgKAflAoa301KbV+x0RKbzxUlPpm2ffPpxT1fVG1K2b2mOiYnOfdGgTBN4rF4gFZ5wQAe2Ru69at7846CQDojfFC4TRm/otZKcXslgA+MHsFAKOjWCyuDrS+iZhf3euxmJlJqfeVtb6IUjJQRdWumOjoQj5/VxAEuOsFMGisfdemTZvqWacBAD1RYGbXKGB39tZau/23ADBaJvL5/I3MfHiqozKfE/j+BWkMNbBF1ZICE10ZBMH7sk4EADojIj+vRNHlWecBAL1R9v1XEXO53eOK6Jx0MwKArJW1voqJ/mYPnrogRH9wnx3c70S0fdlXYH5vuVQ6hnps0IuqHZjo/CAIsOEdYBAwu9dqM+s0AKAnWHa+xmMi+CCt9bNSywgAMhUEweuJ+WUdP0Hk12LtBS1rn1AJw4eEYbhPaMyB7nf3ZyE6UKx9s4j8tOOlgJ73z8ViMaBhO/zXijy32Wz+bOmP7HneuDvUy7N2rfW8/Zn5ACY6XEQOW2pUkYhF3l8uFm+p1Gr3XxdgJNXr9dlyqXR06gN73iVEFLvPUUS+FhrzjfSSAoC0zyvkuPMKlzDReUT09XSyAoCsFIvFMol88IGjlOLNkbXnVqLoaiJqtYlpLZ2z6H59NCiVjmalLiXm/ROuPZXP5T5GRMfRMBVVIlKLOQDwh/f/T3n16qKdnDxNMZ/pvhixF2XOSy53JREd2u18AQbM9kq1+q00B1xqXZpUUDV5cfHs9LICgLQppc7tJI6ZjwyC4BAcwAow3PK5nDszLPEoBSG6fWFh4Zh6ve7OUexYWK1+0/f9gz2iq4j5JXGxzLzf9PT0mnq9volGbfmfO/TXGHNhy9oDhCjxQyIzH+LukqWTHQAs8USpDydGMV9a2bDhF6lkBACp01ofupw9EyzSUQEGAIOpvHp1kZlfkxTnlvEtLi4etdyC6n5RFG2pGHM8iVzVZoB5EjmjEoaH9qqg6klR1WKWbl8ziqJqGIbPIhE3HRjLYz6l2+MDQHta69cz8+MSwjZs3br1wpRSAoAMMNFblhMvRC/yfX+/3mUEAFmSVate4ZrKxcYQ1RabzWNqtdrmFQ5nK8acQiLf+bPri1zTtPaAijGXxiwp7M+iyhPpaNHkHn6xThKR7yXEHb127dp1PcoBAHYxNTU1xcyJ501ZkXfOz8/PpZMVAKRtqTg6ZrlnT3pJTS0AYGCxUomrx0TkvFqtVunSkM1Gs/kqItooIvcI0RGhMSdUq9WIUtDXy/92wy42m6eISPvZMOb8+Pj4nrRsBIBlmpiYeFfSiejujc0Y4/Y7AsCQ8pjPcUXScp8nzCe6JUK9yQoAMsQi8tS4ABH5nTHm090c1BVozVbLFVMHh2H4fUrRoBVV7ov1SyL6QVyMUir2HxEAVq5YLD6aRd6QFMfWntnrKXcAyI4rioT51XvyXCZaZScnE99HAGCwTE9P783Mk7FBzNe7CZNuj12tVu/K4uiWgdhT9RdEYosqInpMz3MAGHGFXO5iNzMcGyTy1Uq1elNqSQFA+iYnz3DF0Z4+nZlPdxPf3U0KALLked5eSTEicjsNkUHaU/UAYf5R3ONMtE+vcwAYZb7vP4OY49dKiyw2ms1zUksKALIwIcynxQWIyNfjlu27JcRa6xN7kh0A9LNtNEQGbvnfkt/HPiqyJrVMAEaPp5iTW6gTXVKr1X6VQj4AkBGt9Wvi9lW6Ymqx2TyTiW6Iu44iOmuAP5MAwIMopeYp2QwNkYFc/tdqtTYkhGzpdQ4Ao0prfQozPz6pReq2hYX3pJcVAGRAKaI3J8R83e2Fbol8JDaK+ZFa6xd1NTsAyMzi4uKGDoqQQ2mIDOTyP6VUfC975vt6nQPACLdQ/8cOQt8+NzfXyV0qABhQO4og5v3jYtjaj7rfoyj6DoncHRtLhMOAAYZEvV7fJER/SAg7loji92YPkIGcave2bo3f0CqyRycyA0C8ibGxdya1UHcfnMIw/GRqSQFAJhTR2XGPi8jPd21UY4lilw0z86Fa6yO7mSMAZOpnsY8yB0EQnERDYiCLqubERDnucRHBPg6ALpuZmXnUUpeuWC0RtxwILdQBhpjW+ghifkpsELObpXpgS4Ax5joRmY19CmarAIaGtfarSTFM9L6ZmZnYGe9BMZBFVY75cXGPC3PsEgMAWL685yW2UBeiL+9Y5gMAQ00lFz9zHIbXPOjvtjPR5QnPe5bv+7F7NgFgMDQajS8Q0UJC2FQ+l/va9PT0w2jADWRRJUod1fYxEVFbtuBDHUD3W6g/LyGs0Wq10EIdYMgFQfBYIXp2XIwV+XiFaOuD/36x1XJFVaPd85iZPWa8jwAMgbm5uXkhuqKD0EeNj439uDwz89c0wAaxqJpgohfGPP7TyubNtRTzARh2nsf8fxKjRD5arVZ/nUpGAJAZFjnXFT/tHheRZqPR+L+7e2x2dtaQyHUJQ7x8r732euiKEwWAzN13332uE/DGDkIfKp73vSAIPrp69erEg4P70cAVVVrrNxBR2y82i3w83YwAhpvW+mRiPiguRkSq2xuN96aXFQBkoVgsBsT8irgYJvpivV7/Y9uAVmtHR8D2F+D8WD6f1KodAAbA5s2bN1iR13USy8yKid74kMnJ32itLykXi0+iATJQRZXW+kAmenfcB7tKFK1PNyuA4bVu3bq1TJTYQp1F3ubap6aTFQBkJZfLvYmICnExzaU26u1UZmfvEJHvxcUI0cnu/WdP8wSA/mGM+bwQxZ9VtwtmXqOYz6B8/vay1ncFQXCW7/sl6nM5GhDFYvHRivkbRDTZNmjnOuxtqSYGMMTGXQt15qQTz++sRNFVKaUEXSBK7RcEwSGZJWDtYzIbG/bYzMzMQxTzKXExInJbtVr9UdK12NqPkOcd0fZx5jUTY2OnzBF9cE/zBYD+EYbhWUEQlJjo5ct6IvNBTHSxx/z+IAhuEJFPGmNcPWCpzwxCUcVa69OY6AOxBZXIV0JjHtxpCAD2kGtx2kkLdStyZj++uUF7TOTWuLtf2VADtUgCluRyuZNdp67YIFcsdaBSrX4l0Po3zLxfTJibFftIXGMLABgYEobhqwOtNzHz65f9bOY8Ex3LzMcGWv9WiC7bvn37Jzdu3NjJfq1U9O1PNq31TBAEZwZa36OYL2XmtgWVEN3eElle5QsAyS3UE5b5iMgXjDG3pJcVAGR4E9YVOe2JhGG1+tkOr2dJ5JLYCOay1jp2/xYADJRmaMypVuQNK1lZxsz7KuaLJsbH/xgEwYf7pbFNJjNVSqnnl33/gY3vlrnAImuFea0i2leIDnng7lX7BkM7iMjXFhqN4+v1+pbeZw4wGnzf/1tifn5C2IIVwUGdACMgCIKXMdHD42KE+TLXNb3Tay62WlflmS90S/3axTCRW9Z/9a6HCAPAYDPGXFYsFm8u5HJXEHPbY5KSMPNDiOjNY4XCaUEQXCEi7zXGxB4wPnRFFRNdsOvyjx3/x+z+/v7HE4nIJmJ+d2iM2xCLpUcAKbdQF6IPR1H023RSAoAsLRU3cbaLyJXLuWatVtscBIHbj9m20x8zH+j7/nOiKLphOdcGgP5Wq9V+RURPL5dKx5DnvZ+IDljB5QquayAznxAEwVvDMLwyixsxfbv8LwkT3eP6V/i+f9SA7A0DGAhBELyWmJ8QFyMiZnFx8X+nlxUAZCUolY4mor+KDRJZvyd3iK21l4hI7I1RxYwZcYAhValWv1wJw8dZkX8gkZWedTnFRJeXtb45iyWBA1tUEfNT3YyXp9TNgdaVIAjejvarACuz4zUkktjAQIgucHeZ08kKALLESiUWNUlt1NvZMdvN/G+x4zMfrrV+8p5cHwAGQssY8+mKMQe0rD3edRVe0dWYn14oFO7UWu/x0sLRKqp24Vo+u25W42Njv9RaH5d1PgCDamJs7B1JLdSF6GfuzS+9rAAgKzMzMwcT89/GBol8t1qt3rWCYRI7BjLReSu4PgAMhlYURddXwvCJVuTprrN30kx2O0xUZKJvlX3/JEpJ15fNtZjFo2wws89EnytrfXnFmDe6m2cZpQIwkC3UyR22l6TZdPsfsI9xsN0pIpWsBmeiaWI+LKvxoXO5XC65mBHZo1mq+4Vh+P1yENxBRE+MCTvWvUfNzs7+z0rGAoDBYIz5LhF9V2v9CLLWbUs4iZn1cq7BzDkh+kRZ64mKMZfSoBVVnkgnfSZ6i/nUQOt9QmOOxfkWAJ3J5XIfSmqhTiKfDWdnf5BaUtAb1l4URtH6rIYPZmb+hnO572c1PnSmvG7dw0XkxXFdeEXkN2EUfXWlY7nGN0z0L+0eZ2aV87yziejUlY4FAIPDGPM7Ino7EV0YBMFLmejsxD2eu2BmFpFLglLpT2G1+qWhW/4nRGdZkefs5tdzheg4ITrBipxnRS4VkVtIZH65YzDzs8tau8OAsy/yAPqc7/tPZ6IXJIRtt0RvSSklAMiYjI+f5e70xgfJx7oxcx2G4WdcA5y4GGZ+tTvDcqVjAcBAaoRheE0lDA9eqhduX05hRUr9y45Zrx7KpGuetfZHURT9ZBlPUb7vH6qInstKnUhEnXX0YH6J1vo2Y8xFe5wswPBTHvOHk4LE2otNFLk7RgAw5KampqZI5KSEWarNC4uLriV6NzSE6DImujAmZkIRuSXK7+zSmAAwgIwxNxLRjWXfP56YLybmoJMzrZjoE0T0zFFvVGFdERZG0TsqYbiPm8kioj918kRF9E+lUqnjaUKAUdNJC3USCZvWunMkAGAETIyNnbZ0sGZ7zP9cr9c3dXHYK9yMeMKYp5WJVnVxTAAYUJUoum7Ltm2PI5FOz7F7hu/78Y13RqCo2lXLTf8tNpuPcfs7EqOZ8zmlEu/CA4yi6enpNZ20ULdEb52dnb0vnawAIGNjSU1rXEeuZrPplv51jTvnSoiuTQjbi1Ls5gUA/W1+fn6uYszzSeSyTuJVB0dEjFJRtYP7gFcx5qUk4jbXx2M+aunwQgDYxXih4Fqol+JiRMQtoW27gRwAhkvZ91+V1GWLiW7sRSc+28F5V8J8puuL1e2xYahgP/1okYoxbxCR5M8qIs8oFovlXiQxsEXV/SrGnEsiyWfmKPWmVBICGBClUumRxOyOHojVsta9diSdrAAgYyxKue5asVorbKPeThRFd5PIt+NimHlf3/dxJmWfKhQK/VDwjmWdAKQvNOZ1JHJ3XAwzewXPO25oGlV0W6PZPCOfyx3JzPvEhP399PT0w+r1+h9TTA2gb3me10kL9eur1eqPUksKADLl+/7zmOgxCWFzzDyttX5xj9L4BRHF7ntQSrnzsz7To/FhBdTi4njWOTBzfFFlLW4UDqcGtVqnUS4Xf/TLzgPNL+n24ENx+G+tVttc9v33ErPr6tG2neLY2NiziejKdLMD6D9a66OY6JiEsG20sIAW6gAjpMP9BusUc/Ke5h5ioie5oyCiKPpOlnmMGqtUI+kzXiuXW0sZWmpkEl9UKbU1tYQgVZXZ2R8GWt/GzIe0DWI+fCCW/2V2+G8UrReR+C5EIj1rowgwQJTqoIU6iVxUmZv7QyoZAUDmfN8/jIn+mgbE0mwVpIiZNyfFeESx+/F6zWpdSoyxtptdK6HPMNHnE0KmerGvSvVipooyUCFydx1ujYvhpLbRACMg2Nk5K+mYgT+RMR9IKSUA6AOKuWddsXqBiY4ulUr4uZ6iRqORWIwI0b6UrbitIB0XhzC4LNF/JMXkcrlHd3vc4Zmp2vkGG/tFFJH9EveQAAx7C3Xm9ybFCdH5SzcqAGAEzMzM7E/JS4L7jjdgheCgq9frsyLSig1S6rGUIWY+ICnGWltPJxvIQrPZTDzLlpn36va4QzNT5QhzmNTxo1QqrUsvI4D+UigU3pbUQp1EfhKGYdJZMQAwRHJKncPMg9cRmPllrglV1mmMkAVm/k1cABM9Ob10djO+SNJKDFpYWHDNUGB4bU4KEJHV3R50qGaqrLUbs/giAgwC3/f3U8yxRwuIuwUp8ma0UAcYHVrrGVbqBBpAzJwby+fduVWQEiH6r9jHRQ5at25dds0qmJ8W+7hI6A6MTS2fEVdet+7hWuvjylpfFGj9vZTOjU38rM/WLnZ70KHo/nc/RbQmMUap+GlrgCGllPpQYkck5vWRMf+eWlIAkDlFdAYRTdCgYn7t1NTUhRs3bky8sQpdcRsRvSD2HKBC4VlEdH0GNw9LIvIE5pj7+8z3pJnTiMn7vn+4InoKKfVkEnkKMev7Z3Dcv4pV6upeJ5HL5YKkGFFqru+Lqkz3VHWwjrbRaGAdLYwcrfWRTHRsXIwQbV1YWDg/vawAIGs72k8zn5YYKHK+MGdStLDIS4n5qLaPM69eNTb2+o1E7083s9Fkrb3JU+o9cTGK+cVZFFUe0fMpYRmrFYk/wwj22Jo1a1Z7St38wF/sprhVRI/odR7MnLivT0S6Xg8MxeG/u/hfcQ+6lU1zc3NoowmjpqMW6iLygXq9fm86KQFAX9D6NUQUv2Fb5NuVDLuBBkFwOxP9NC5Gdi5tdu9zC+llNpqiKPppOQjcXf62e9SZ6HluWakxZjbV5JQ6MTGk2bwhnWRGz6ZNm+qTk5M1Jiq2ixGiQ1NI5ZCkrQ6NRuPn3R508DaltjE9Pb23uOnGGLxzHTD2isBIKfu++9B0cELYH40xF6WUEgD0B0+IEvcjCbNbOpyZMAxvE5HvxcUwsy77/ivTy2qkWRL5SmwEc14RnZ7qz7qZmScSUdJ+qkqlVrsjtaRGkYhbHtoe8xHFYrGX/Q2YRZ4dH8D/PTc3N9/tgYemqBovFN7IsYtod/xg+HF6GQFkz71xSQct1MnatxDRtlSSAoC+oLV+ETO7o0baE7k7DMNvpJZUuzSIEm/6iFLnLG3bgB4T5qsSg5jPmJqamqK0eF7skkRHmD+Lm+u9xUk3QIhWFTzvpb0aX2v9LGKO31Ml8sNejD0URVWxWHw0Mb8xKY6tvSWdjAD6Qy6Xcy3U/dggkR9Xoui61JICgL7ARK4IiWWJLqY+YIz5mojEdp1josf4vv+89LIaXWEYfp9E/ichbN3ExMS708hHa/1sYn5O0hYQa+0laeQzyizzVzq4AfIONx/Si/GZ+YLEIGt7st9v4Isq17azkMt9PrGrGVG9EkVfSiktgH5poe7ao8euK7ZEsW3WAWBIm9cwJ+1t+JMxZj31B7EiiQWeUuq8dNIBS/SRxCCR00ulUvySvBVye7cU0Sc6CP1yFEW/7WUuQO4GiLv58Z9xMUz08LLWyatolsn3/ddwQn8F11K/Uq1+h3pgoIuqYrFYHh8bu5mYD0qKFWs/TUTb08kMIHuK+aIObjZcY4yJ3QAOAMOHic5NDBJxd/W7fpbLnoqi6FoRMXEx7gNVqVR6anpZjS5jzMdFJLZIce3VPc+7bq+99npoj9KYUET/RszluKAd9w+Z39ejHODBrL00MYb5bN/3u7YMsFQq/ZVi7mQm0t0M6MnxSoNaVCmt9Qn5XO5OZo7t8LGkLngxwQjRWh/BzC+MixGRLYvN5lvTywoA+oHW+nFE5M4RaktENm9bWLiS+svCUqEXy/O85IIRumGRmN+VFORmJcYKhW+7Q2C7OfiaNWumgyC4iZgTi2gmuiIMw9u7OT60V4mia1xTkKQ4xfyvWuuXrHQ8rfWBnlLfYObJxFkqYz5GPTJQRVWxWAwC339TEAT3KOZPM/NMR0+09rzU23oC9HkLdWJ+f61WS3zTA4DhoojOSWrsRESf6EV3rJXaun37FSJyX2yQyAt27LWGngvD8F+F6FsdhB5A4+M/C0ql2PMSO1UulZ75kMnJOxOXeu28QWC2LSwk77OBblqwRIk3bZk5x0TXl7X+0J7usSqXSsco5ltdB9CkWEt0QS+bcmVyTpVSau+ZmZkNu3tMRNxUccGzdq24osnz9iWiA92pzMz8+OWOJUTrwyhK7lIDMCTKvu/O6XCtZeNsZ2t/3a0fcCthmW+NoqiadR4Ao8Atmyfml8fFiEhzodFI3i+Tgfn5+blVq1Z9imL2gjKzyufzZxPRKelmN5Kk1Wqd4Cl1FzOXEmL3Ys/7YqD1La6bozHGdZW0yxhL+b7/dKWUm4n8u46SE2kR84n9eINg2Bljrgm0PomZD4+LW7rBc3Y5CF4i1r6Ho+jaCtHWpOv7vn+QUupCIjqmk3xE5IvGmKuphzIpqpjo8/lcwtBK/Xlf1MSban/JnWsRGuM+YKJ9JoxSC/V/6uDVMk5Kre+H3sNeq3U0dXanEwBWKJfLuWKkEBvE/Jl6vf5H6lMi4gq+091+nXYxTHRCqVR6Z7VajdLNbvS4r3G5VHqVKHWjm3lIimfmI5noyLLWoYh8m5T6oYj8SkR+T0T3tVqtbblcblxEVjPzw5n5ABJ5GhM9I2nv1G4GO7cfjgQYUULMJ5DIfxLz2g7iH8ZKfZy0vihgvlFEblLN5l2LzJVWq7WVmVcXCoVHsshhxPyCxDPJ/iwR+sN9W7acTD3W9aKqxSxt3+XSJHJDs9U6nogaWacCkJZ8Pn8BE8W3UAeAkTQ9Pb1GdTB702w2Mz3sN4kx5ndlrT9HRC+LCRv3mM8gorenmNrIqlSr39Jav4JE1scVu3+GOWBmd2DzK3dMVizdPPeU+sub6XtyY93aK8MoSl4KDz0ThuHvg1LppaTUDZ0U3Dswr2Wil7ObUc/nKe8+2+w6EbPM7wUhqnGjcfTmzZt3u0Kur/dUeSKZ3vx2LaJJ5OKKMS+YnZ2NX3cNMER839+Xic7MOg8A6E+FQuHkDu4Y3zw7O3sn9TlhTiz8WKnTfN+P37gOXWOM+axbarfzpI5sWZEPhlF0atZ5AFFYrX5TiF6b0ffFnGvKU9mw4RdpDKZ6MVNFGRGRe9jav6kY4w40zPxFDZAmxfzBDlqoA8Boyivm5DPpWi13FEPf29HJTeS7CWHrFNFrU0oJdv67XMPWus6SPZ8VaLeHSqw90xjzFmz96B/GmE9bkVekvHrsV43FxcPCMLwtrQGHYqZKiH5B1r42NOaJlWr11rTHB8haEASHM/NxWecBAP1Ja+2Ww+8dGyRyl1vGRQPCEiUvU2Q+M6v946PKfQ9ZEXfczR1pfxYUoqeFUdSXTVZGXRRF17esPcIdKt7rsUTkC1u2bj2sVqv9ilI0UC3VdyUim4ToWivy3DAMD6xE0af66ZBCgJRfx1g3DgCxbdS7saSunxhjvu5WqMTFMPM+Zd9f8Tk4sPx9b5UwPMyKvNN1m+3xcAtW5ANhGD7RGPMfPR4LViCKon/fsnXrQSTSmy58IhVptV4YGnOc6xRKKRukomqDEN1EIv9IrdbRoTGlMAxfaYy5EVO8MMp83/8HJnpS1nkAQH8KguDvifmghLB7wzC8ngaLCNHFiVE7W3BD+hrGmPcsNBr7k8hl7sD5bl7cXc+KXErbtz/aGHN+CsUbdMH8/PxcxZgTW9YeRq77Y7eKKWvPrBizf1itfoky0vUp8e3N5i8KSp2+gkvYpYO53Itvi7X2Xmvtb2u12uYupgk9wK3W1VapH7V7XInU081oNDDzZiuyktdcphrN5s+zzmGYLC4ubuBCIfb7odlqpbbGfHcWRX6dS/iezefzqd9lHFYisiBESe8R/28QV3sYY67VWq/qpPNhvV7flE5WsKsNGza45V5vWLdu3QXj4+MvYyK3VP3wxNb+u+e+l29haz+3sLj4OfybDq4oin5CRM/wff/xzHyyYj42cYnyX34vfE1ErjPGfMX9mTLWD8fUAAAAAMDomNBaP5lFDiaixzLz3rLzOBDXrXGMmF1Dgy0kUiWRP5BSv6Rm87Zwdva2pRvvMHy4VCod5HneU8l9XzC7jsY7vydEthNzJNYaZr7bEv1ERG6Loqirs58AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0hP4/640nTqdytdsAAAAASUVORK5CYII='


function bookingEmailWrapper(content: string, badge: string) {
  return `
    <div style="font-family:${FONT};background:#f1f5f9;padding:40px 16px;min-height:100vh;">
      <div style="max-width:520px;margin:0 auto;">
        <!-- Header -->
        <div style="background:#ffffff;border-radius:10px 10px 0 0;padding:24px 32px;border:1px solid #e2e8f0;border-bottom:none;">
          <img src="${LOGO_DATA_URI}" alt="BizHaus" style="height:20px;width:auto;vertical-align:middle;" />
          <span style="background:${BOOKING_GREEN};color:white;font-size:12px;font-weight:700;padding:4px 10px;border-radius:5px;margin-left:10px;">${badge}</span>
        </div>
        <!-- Body -->
        <div style="background:#ffffff;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;">
          ${content}
        </div>
        <!-- Footer -->
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          © ${new Date().getFullYear()} BizHaus ·
          <a href="mailto:bookings@bizhaus.com" style="color:#94a3b8;">bookings@bizhaus.com</a>
        </p>
      </div>
    </div>
  `
}

export async function sendInviteEmail(to: string, token: string) {
  const link = `${APP_URL}/setup-account?token=${token}`
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You're invited to the BizHaus Member Portal",
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">You're invited!</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">You've been given access to the BizHaus Member Portal — book rooms, connect with the community, and more. Click below to set up your account.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">Set Up My Account →</a>
      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">This link expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
    `),
  })
}

export async function sendConfirmationEmail(
  to: string,
  details: { title: string; room: string; location: string; date: string; time: string; booker: string }
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reservation confirmed: ${details.title}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 20px;font-size:22px;font-weight:700;">Reservation Confirmed ✓</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Meeting</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.title}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td><td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td><td style="padding:10px 14px;color:#1e293b;">${details.date}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td><td style="padding:10px 14px;color:#1e293b;">${details.time}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Booked by</td><td style="padding:10px 14px;color:#1e293b;">${details.booker}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">Need to cancel? Log in to BizHaus and cancel from the calendar — at least 24 hours before your reservation.</p>
    `),
  })
}

export async function sendExternalBookingReceipt(
  to: string,
  details: {
    confirmationNumber: string
    room: string
    location: string
    date: string
    time: string
    guestName: string
    amountPaid: string
    cardLast4: string | null
    cardBrand: string | null
    paymentDate: string
  }
) {
  const cardLine = details.cardLast4
    ? `${(details.cardBrand ?? 'Card').charAt(0).toUpperCase() + (details.cardBrand ?? 'card').slice(1)} ending in ${details.cardLast4}`
    : 'Card on file'

  await resend.emails.send({
    from: FROM,
    to,
    subject: `BizHaus Receipt — ${details.room} on ${details.date}`,
    html: bookingEmailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">Booking Confirmed ✓</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>

      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.date}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.time}</td>
        </tr>
      </table>

      <h3 style="color:#0f172a;margin:0 0 12px;font-size:15px;font-weight:700;">Payment Receipt</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Amount</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Paid with</td>
          <td style="padding:10px 14px;color:#1e293b;">${cardLine}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.paymentDate}</td>
        </tr>
      </table>

      <a href="${APP_URL}/day-pass/account" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">View My Reservations →</a>

      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">
        <strong style="color:#64748b;">Cancellation policy:</strong> Bookings are non-refundable. To inquire about credit toward a future booking, contact us at
        <a href="mailto:hello@bizhaus.com" style="color:#4f9645;text-decoration:none;">hello@bizhaus.com</a>.
      </p>
    `, 'Bookings'),
  })
}

export async function sendDayPassConfirmation(
  to: string,
  details: {
    confirmationNumber: string
    location: string
    date: string
    guestName: string
    amountPaid: string
    cardLast4: string | null
    cardBrand: string | null
    paymentDate: string
  }
) {
  const cardLine = details.cardLast4
    ? `${(details.cardBrand ?? 'Card').charAt(0).toUpperCase() + (details.cardBrand ?? 'card').slice(1)} ending in ${details.cardLast4}`
    : 'Card on file'

  await resend.emails.send({
    from: FROM,
    to,
    subject: `BizHaus Day Pass Receipt — ${details.location} on ${details.date}`,
    html: bookingEmailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">Day Pass Confirmed ✓</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>

      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Location</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.location}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.date}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td>
          <td style="padding:10px 14px;color:#1e293b;">9:00am – 5:00pm</td>
        </tr>
      </table>

      <h3 style="color:#0f172a;margin:0 0 12px;font-size:15px;font-weight:700;">Payment Receipt</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Amount</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Paid with</td>
          <td style="padding:10px 14px;color:#1e293b;">${cardLine}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.paymentDate}</td>
        </tr>
      </table>

      <a href="${APP_URL}/day-pass/account" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">View My Reservations →</a>

      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">
        <strong style="color:#64748b;">Cancellation policy:</strong> Reservations may be canceled for a full refund until 12:00am (midnight) the night before your reservation date. Contact us at
        <a href="mailto:hello@bizhaus.com" style="color:#4f9645;text-decoration:none;">hello@bizhaus.com</a>.
      </p>
    `, 'Day Pass'),
  })
}

export async function sendExternalBookingStaffNotification(
  details: { confirmationNumber: string; guestName: string; guestEmail: string; room: string; location: string; date: string; time: string; amountPaid: string }
) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `New room booking: ${details.guestName} — ${details.room}, ${details.location}`,
    html: bookingEmailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">New Room Booking</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName} (${details.guestEmail})</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.date}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.time}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Amount paid</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/reservations" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">View Bookings →</a>
    `, 'Bookings'),
  })
}

export async function sendDayPassStaffNotification(
  details: { confirmationNumber: string; guestName: string; guestEmail: string; location: string; date: string; amountPaid: string }
) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `New day pass: ${details.guestName} — ${details.location}`,
    html: bookingEmailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 4px;font-size:22px;font-weight:700;">New Day Pass Booked</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">Confirmation #${details.confirmationNumber}</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Guest</td>
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.guestName} (${details.guestEmail})</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Location</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.location}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:10px 14px;color:#1e293b;">${details.date}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">Amount paid</td>
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${details.amountPaid}</td>
        </tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/day-passes" style="display:inline-block;background:#6ec664;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">View Day Passes →</a>
    `, 'Day Pass'),
  })
}

export async function sendCancellationEmail(
  to: string,
  details: { title: string; room: string; location: string; date: string; time: string }
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reservation cancelled: ${details.title}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">Reservation Cancelled</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 20px;">The following reservation has been cancelled:</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Meeting</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.title}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td><td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td><td style="padding:10px 14px;color:#1e293b;">${details.date}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td><td style="padding:10px 14px;color:#1e293b;">${details.time}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;margin:0;border-top:1px solid #f1f5f9;padding-top:20px;">Questions? Contact your BizHaus admin.</p>
    `),
  })
}

export async function sendRoomAccessGrantedEmail(to: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You're set up to book rooms",
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">You're all set, ${name}!</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">Your BizHaus admin just gave you access to book conference rooms. Click below to check availability and reserve a room.</p>
      <a href="${APP_URL}/dashboard/rooms" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">Book a Room →</a>
    `),
  })
}

export async function sendCancellationRequestEmail(
  details: { name: string; email: string; title: string; room: string; location: string; date: string; time: string }
) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `Cancellation request (within 12h): ${details.title}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">Cancellation requested</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">This reservation starts within 12 hours, so ${details.name} couldn't cancel it themselves — please review and cancel it in Admin if appropriate.</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Requested by</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.name} (${details.email})</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Meeting</td><td style="padding:10px 14px;color:#1e293b;">${details.title}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Room</td><td style="padding:10px 14px;color:#1e293b;">${details.room} — ${details.location}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Date</td><td style="padding:10px 14px;color:#1e293b;">${details.date}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Time</td><td style="padding:10px 14px;color:#1e293b;">${details.time}</td></tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/reservations" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">Open Reservations →</a>
    `),
  })
}

export async function sendFeedbackNotificationEmail(
  details: { name: string; email: string; category: string; message: string }
) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `New feedback (${details.category}): ${details.name}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">New feedback submitted</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">From</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.name} (${details.email})</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Category</td><td style="padding:10px 14px;color:#1e293b;">${details.category}</td></tr>
      </table>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;white-space:pre-wrap;background:#f8fafc;border-radius:7px;padding:14px;">${details.message}</p>
      <a href="${APP_URL}/dashboard/admin/feedback" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">View Feedback →</a>
    `),
  })
}

export async function sendRoomAccessRequestEmail(details: { name: string; email: string }) {
  await resend.emails.send({
    from: FROM,
    to: STAFF_EMAIL,
    subject: `Room access requested: ${details.name}`,
    html: emailWrapper(`
      <h2 style="color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700;">Room access requested</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">A member portal user has requested access to book rooms. Activate them by assigning a company and hours allotment in Members.</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;background:#f8fafc;border-radius:7px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:110px;">Name</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${details.name}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:10px 14px;color:#64748b;font-size:13px;">Email</td><td style="padding:10px 14px;color:#1e293b;">${details.email}</td></tr>
      </table>
      <a href="${APP_URL}/dashboard/admin/members" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:600;font-size:15px;">Open Members →</a>
    `),
  })
}
